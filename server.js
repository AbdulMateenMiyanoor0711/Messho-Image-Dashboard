const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');

const app = express();
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } 
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.post('/api/generate', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No image provided.' });

    const canvasSize = 1500; 
    // Get the scale from the frontend slider (default to 0.5 if missing)
    const userScale = parseFloat(req.body.scale) || 0.5;
    
    // We apply the exact scale the user chose to these 10 background colors
    const variations = [
        { color: '#ff7b24' }, // Orange
        { color: '#ffffff' }, // White
        { color: '#000000' }, // Black
        { color: '#f0f0f0' }, // Light Grey
        { color: '#e6f7ff' }, // Light Blue
        { color: '#fff1f0' }, // Light Red
        { color: '#f5f5dc' }, // Beige
        { color: '#e6ffed' }, // Light Green
        { color: '#fffbe6' }, // Light Yellow
        { color: '#f9f0ff' }  // Light Purple
    ];

    try {
        const generatedImages = [];
        const productSize = Math.floor(canvasSize * userScale);

        // 1. Shrink original product once
        const resizedProduct = await sharp(req.file.buffer)
            .resize(productSize, productSize, { 
                fit: 'contain', 
                background: { r: 255, g: 255, b: 255, alpha: 0 } 
            })
            .toBuffer();

        // 2. Loop through colors and paste the resized product
        for (let i = 0; i < variations.length; i++) {
            const v = variations[i];
            
            const finalBuffer = await sharp({
                create: { 
                    width: canvasSize, 
                    height: canvasSize, 
                    channels: 4, 
                    background: v.color 
                }
            })
            .composite([{ input: resizedProduct, gravity: 'center' }])
            .jpeg({ quality: 95 })
            .toBuffer();

            const base64Image = `data:image/jpeg;base64,${finalBuffer.toString('base64')}`;
            
            generatedImages.push({
                url: base64Image,
                filename: `meesho_var_${i + 1}_scale_${Math.round(userScale*100)}.jpg`
            });
        }

        res.json({ success: true, images: generatedImages });
    } catch (error) {
        console.error('Error generating images:', error);
        res.status(500).json({ error: 'Failed to process images.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

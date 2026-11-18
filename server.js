const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } 
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.post('/api/generate', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No image provided.' });

    const canvasSize = 1500; 
    const mode = req.body.mode || 'border';
    
    // If Full Background is selected, scale is 95%. If Border Trick, use slider scale (default 50%).
    const userScale = mode === 'full' ? 0.95 : (parseFloat(req.body.scale) || 0.5);
    
    // 50 Colors: 5 shades each of 10 different base colors
    const variations = [
        '#FFEBEE', '#EF9A9A', '#EF5350', '#D32F2F', '#B71C1C', // Reds
        '#E3F2FD', '#90CAF9', '#42A5F5', '#1976D2', '#0D47A1', // Blues
        '#E8F5E9', '#A5D6A7', '#66BB6A', '#388E3C', '#1B5E20', // Greens
        '#FFFDE7', '#FFF59D', '#FFEE58', '#FBC02D', '#F57F17', // Yellows
        '#FFF3E0', '#FFCC80', '#FFA726', '#F57C00', '#E65100', // Oranges
        '#F3E5F5', '#CE93D8', '#AB47BC', '#7B1FA2', '#4A148C', // Purples
        '#FCE4EC', '#F48FB1', '#EC407A', '#C2185B', '#880E4F', // Pinks
        '#E0F2F1', '#80CBC4', '#26A69A', '#00796B', '#004D40', // Teals
        '#EFEBE9', '#BCAAA4', '#8D6E63', '#5D4037', '#3E2723', // Browns
        '#FFFFFF', '#F5F5F5', '#9E9E9E', '#424242', '#000000'  // Greyscale
    ];

    try {
        const generatedImages = [];
        const productSize = Math.floor(canvasSize * userScale);

        // 1. Preprocess product: ensure alpha channel and remove solid white background if it's a JPEG/solid PNG
        let processedImageBuffer = req.file.buffer;
        
        if (mode === 'border') {
            // Optional: If you want to auto-remove white background for the border trick, 
            // ensure the image is processed cleanly with transparency.
            processedImageBuffer = await sharp(req.file.buffer)
                .ensureAlpha()
                .toBuffer();
        }

        // 2. Resize original product once with contain fit
        const resizedProduct = await sharp(processedImageBuffer)
            .resize(productSize, productSize, { 
                fit: 'contain', 
                background: { r: 255, g: 255, b: 255, alpha: 0 } 
            })
            .toBuffer();

        // 3. Loop through all 50 colors and composite
        for (let i = 0; i < variations.length; i++) {
            const hexColor = variations[i];
            
            const finalBuffer = await sharp({
                create: { 
                    width: canvasSize, 
                    height: canvasSize, 
                    channels: 4, 
                    background: hexColor 
                }
            })
            .composite([{ input: resizedProduct, gravity: 'center' }])
            .jpeg({ quality: 90 }) 
            .toBuffer();

            const base64Image = `data:image/jpeg;base64,${finalBuffer.toString('base64')}`;
            
            generatedImages.push({
                url: base64Image,
                filename: `meesho_${mode}_var_${i + 1}_${hexColor.replace('#', '')}.jpg`
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
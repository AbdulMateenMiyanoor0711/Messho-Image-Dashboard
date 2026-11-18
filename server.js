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
    const userScale = parseFloat(req.body.scale) || 0.5;
    
    // 50 Colors: 5 shades each of 10 different base colors
    const variations = [
        // Reds
        '#FFEBEE', '#EF9A9A', '#EF5350', '#D32F2F', '#B71C1C',
        // Blues
        '#E3F2FD', '#90CAF9', '#42A5F5', '#1976D2', '#0D47A1',
        // Greens
        '#E8F5E9', '#A5D6A7', '#66BB6A', '#388E3C', '#1B5E20',
        // Yellows
        '#FFFDE7', '#FFF59D', '#FFEE58', '#FBC02D', '#F57F17',
        // Oranges
        '#FFF3E0', '#FFCC80', '#FFA726', '#F57C00', '#E65100',
        // Purples
        '#F3E5F5', '#CE93D8', '#AB47BC', '#7B1FA2', '#4A148C',
        // Pinks
        '#FCE4EC', '#F48FB1', '#EC407A', '#C2185B', '#880E4F',
        // Teals
        '#E0F2F1', '#80CBC4', '#26A69A', '#00796B', '#004D40',
        // Browns
        '#EFEBE9', '#BCAAA4', '#8D6E63', '#5D4037', '#3E2723',
        // Greyscale (White to Black)
        '#FFFFFF', '#F5F5F5', '#9E9E9E', '#424242', '#000000'
    ];

    try {
        const generatedImages = [];
        const productSize = Math.floor(canvasSize * userScale);

        // 1. Shrink original product once to save processing power
        const resizedProduct = await sharp(req.file.buffer)
            .resize(productSize, productSize, { 
                fit: 'contain', 
                background: { r: 255, g: 255, b: 255, alpha: 0 } 
            })
            .toBuffer();

        // 2. Loop through all 50 colors instantly
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
            .jpeg({ quality: 90 }) // Slightly reduced quality (95 to 90) so the 50-image ZIP downloads faster
            .toBuffer();

            const base64Image = `data:image/jpeg;base64,${finalBuffer.toString('base64')}`;
            
            generatedImages.push({
                url: base64Image,
                // The filename will now include the actual hex color code (e.g., meesho_var_1_FFEBEE.jpg)
                filename: `meesho_var_${i + 1}_${hexColor.replace('#', '')}.jpg`
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

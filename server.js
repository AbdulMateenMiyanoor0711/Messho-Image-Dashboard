const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');

const app = express();
// Increase file size limit to handle high-res photos
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Serve the frontend HTML from the public folder
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Main image generation API
app.post('/api/generate', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No image provided.' });

    const canvasSize = 1500; // Amazon & Meesho standard size
    
    // Variations: Defines how small the product gets (scale) and the background color
    const variations = [
        { scale: 0.3, color: '#ff7b24' },  // Tiny on Orange
        { scale: 0.4, color: '#ff7b24' },  // Small on Orange
        { scale: 0.3, color: '#ffffff' },  // Tiny on White
        { scale: 0.4, color: '#ffffff' },  // Small on White
        { scale: 0.3, color: '#000000' },  // Tiny on Black
        { scale: 0.4, color: '#000000' },  // Small on Black
        { scale: 0.3, color: '#f0f0f0' },  // Tiny on Light Grey
        { scale: 0.35, color: '#e6f7ff' }, // Small on Light Blue
        { scale: 0.3, color: '#fff1f0' },  // Tiny on Light Red
        { scale: 0.4, color: '#f5f5dc' }   // Small on Beige
    ];

    try {
        const generatedImages = [];

        for (let i = 0; i < variations.length; i++) {
            const v = variations[i];
            const productSize = Math.floor(canvasSize * v.scale);
            
            // 1. Shrink original product, keeping aspect ratio and ensuring transparent background
            const resizedProduct = await sharp(req.file.buffer)
                .resize(productSize, productSize, { 
                    fit: 'contain', 
                    background: { r: 255, g: 255, b: 255, alpha: 0 } 
                })
                .toBuffer();

            // 2. Paste the small product onto the solid 1500x1500 canvas
            const finalBuffer = await sharp({
                create: { 
                    width: canvasSize, 
                    height: canvasSize, 
                    channels: 4, 
                    background: v.color 
                }
            })
            .composite([{ input: resizedProduct, gravity: 'center' }])
            .jpeg({ quality: 95 }) // Output as high-quality JPG
            .toBuffer();

            // Convert to base64 so frontend can download directly
            const base64Image = `data:image/jpeg;base64,${finalBuffer.toString('base64')}`;
            
            generatedImages.push({
                url: base64Image,
                filename: `meesho_optimized_var_${i + 1}.jpg`
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

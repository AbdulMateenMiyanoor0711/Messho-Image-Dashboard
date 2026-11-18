const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const axios = require('axios'); 
const FormData = require('form-data'); 

const app = express();
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } 
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// --- PHOTOROOM AI GENERATOR ---
async function generatePhotoRoomBackground(imageBuffer) {
    // This tells the app to grab the API key from Render's settings
    const apiKey = process.env.PHOTOROOM_API_KEY; 
    
    if (!apiKey) {
        throw new Error('PhotoRoom API key is missing from Environment Variables');
    }

    const formData = new FormData();
    formData.append('image_file', imageBuffer, { filename: 'upload.jpg' }); 
    // You can change this prompt to whatever scene you want!
    formData.append('prompt', 'Product sitting on a clean marble table with bright studio lighting');

    const response = await axios.post('https://image-api.photoroom.com/v2/edit', formData, {
        headers: {
            ...formData.getHeaders(),
            'x-api-key': apiKey
        },
        responseType: 'arraybuffer' 
    });

    return `data:image/jpeg;base64,${Buffer.from(response.data).toString('base64')}`;
}

// --- MAIN GENERATION API ---
app.post('/api/generate', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No image provided.' });

    const canvasSize = 1500; 
    const variations = [
        { scale: 0.3, color: '#ff7b24' },  { scale: 0.4, color: '#ff7b24' },
        { scale: 0.3, color: '#ffffff' },  { scale: 0.4, color: '#ffffff' },
        { scale: 0.3, color: '#000000' },  { scale: 0.4, color: '#000000' },
        { scale: 0.3, color: '#f0f0f0' },  { scale: 0.35, color: '#e6f7ff' },
        { scale: 0.3, color: '#fff1f0' },  { scale: 0.4, color: '#f5f5dc' }
    ];

    try {
        const generatedImages = [];

        // 1. Instantly generate the 10 border variations for Meesho AI sizing
        for (let i = 0; i < variations.length; i++) {
            const v = variations[i];
            const productSize = Math.floor(canvasSize * v.scale);
            
            const resizedProduct = await sharp(req.file.buffer)
                .resize(productSize, productSize, { 
                    fit: 'contain', 
                    background: { r: 255, g: 255, b: 255, alpha: 0 } 
                })
                .toBuffer();

            const finalBuffer = await sharp({
                create: { width: canvasSize, height: canvasSize, channels: 4, background: v.color }
            })
            .composite([{ input: resizedProduct, gravity: 'center' }])
            .jpeg({ quality: 95 })
            .toBuffer();
            
            generatedImages.push({
                url: `data:image/jpeg;base64,${finalBuffer.toString('base64')}`,
                filename: `meesho_border_var_${i + 1}.jpg`
            });
        }

        // 2. Generate 1 realistic AI lifestyle image using PhotoRoom
        try {
            const aiImageBase64 = await generatePhotoRoomBackground(req.file.buffer);
            generatedImages.unshift({ // unshift puts it at the very beginning of the gallery
                url: aiImageBase64,
                filename: 'photoroom_ai_lifestyle.jpg'
            });
        } catch (apiError) {
            console.error('PhotoRoom generation failed:', apiError.message);
            // If the API fails, it will safely ignore it and still give you the 10 border images
        }

        res.json({ success: true, images: generatedImages });
    } catch (error) {
        console.error('Error generating images:', error);
        res.status(500).json({ error: 'Failed to process images.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

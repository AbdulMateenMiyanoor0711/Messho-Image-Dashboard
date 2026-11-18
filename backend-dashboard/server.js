const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const cors = require('cors');

const app = express();

// ENABLE CORS SO THE CHROME EXTENSION CAN TALK TO THIS SERVER
app.use(cors());

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } 
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// PhotoRoom AI Generator
async function generatePhotoRoomBackground(imageBuffer) {
    const apiKey = process.env.PHOTOROOM_API_KEY; 
    if (!apiKey) return null; // Skip if no key is provided in Render

    const formData = new FormData();
    formData.append('image_file', imageBuffer, { filename: 'upload.jpg' }); 
    formData.append('prompt', 'Product sitting on a clean marble table with bright studio lighting');

    const response = await axios.post('https://image-api.photoroom.com/v2/edit', formData, {
        headers: { ...formData.getHeaders(), 'x-api-key': apiKey },
        responseType: 'arraybuffer' 
    });

    return `data:image/jpeg;base64,${Buffer.from(response.data).toString('base64')}`;
}

app.post('/api/generate', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No image provided.' });

    const canvasSize = 1500; 
    const mode = req.body.mode || 'border';
    const userScale = mode === 'full' ? 0.95 : (parseFloat(req.body.scale) || 0.5);
    
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

        // 1. PhotoRoom AI Background (if key exists)
        try {
            const aiImage = await generatePhotoRoomBackground(req.file.buffer);
            if (aiImage) {
                generatedImages.push({ url: aiImage, filename: 'photoroom_ai_lifestyle.jpg' });
            }
        } catch (apiError) {
            console.error('PhotoRoom API failed, skipping AI image:', apiError.message);
        }

        // 2. Shrink original product
        const resizedProduct = await sharp(req.file.buffer)
            .resize(productSize, productSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
            .toBuffer();

        // 3. Generate 50 Colors
        for (let i = 0; i < variations.length; i++) {
            const hexColor = variations[i];
            const finalBuffer = await sharp({
                create: { width: canvasSize, height: canvasSize, channels: 4, background: hexColor }
            })
            .composite([{ input: resizedProduct, gravity: 'center' }])
            .jpeg({ quality: 90 }) 
            .toBuffer();

            generatedImages.push({
                url: `data:image/jpeg;base64,${finalBuffer.toString('base64')}`,
                filename: `meesho_${mode}_var_${i + 1}_${hexColor.replace('#', '')}.jpg`
            });
        }

        res.json({ success: true, images: generatedImages });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to process images.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

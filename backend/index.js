const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// Create a downloads folder if it doesn't exist
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Multer configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname)
    }
});
const upload = multer({ storage: storage });

// Route for uploading files
app.post('/api/v1/jobs', upload.array('files'), (req, res) => {
    res.status(201).json({
        jobId: "UUID-will-go-here",
        status: "pending",
        message: "Files received. Waiting for checks."
    });
});

app.listen(PORT, () => {
    console.log(`Backend started on http://localhost:${PORT}`);
});
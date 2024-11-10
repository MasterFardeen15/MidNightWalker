const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDiv = document.getElementById('status');
const errorDiv = document.getElementById('error');
const leftBulb = document.getElementById('leftBulb');
const middleBulb = document.getElementById('middleBulb');
const rightBulb = document.getElementById('rightBulb');

let model = null;
let stream = null;
let isDetecting = false;
let animationId = null;

function updateBulbBrightness(bulb, brightness) {
    const baseColor = 102;
    const brightColor = 255;
    const color = Math.floor(baseColor + (brightColor - baseColor) * brightness);
    const bulbCircle = bulb.querySelector('circle');
    bulbCircle.setAttribute('fill', `rgb(${color}, ${color}, ${color})`);
    bulb.style.filter = `drop-shadow(0 0 ${brightness * 10}px rgb(${color}, ${color}, ${color}))`;
}

function calculateProximityBrightness(person) {
    const maxHeight = canvas.height * 0.8;
    const minHeight = canvas.height * 0.2;
    const height = person.bbox[3];
    
    let brightness = (height - minHeight) / (maxHeight - minHeight);
    brightness = Math.max(0.3, Math.min(1, brightness));
    
    return 1;
}

async function loadModel() {
    try {
        model = await cocoSsd.load();
        statusDiv.textContent = 'Model loaded. Click Start Detection to begin.';
        startBtn.disabled = false;
    } catch (error) {
        showError('Failed to load model: ' + error.message);
    }
}

async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        video.srcObject = stream;
        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                resolve();
            };
        });
    } catch (error) {
        showError('Failed to access camera: ' + error.message);
        throw error;
    }
}

async function detectObjects() {
    if (!isDetecting) return;

    try {
        const predictions = await model.detect(video);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const person = predictions.find(pred => pred.class === 'person');
        
        if (person) {
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 2;
            ctx.strokeRect(...person.bbox);

            const brightness = calculateProximityBrightness(person);
            const centerX = person.bbox[0] + (person.bbox[2] / 2);
            const screenWidth = canvas.width;
            const relativePosition = centerX / screenWidth;

            if (relativePosition <= 0.33) {
                updateBulbBrightness(leftBulb, brightness);
                updateBulbBrightness(middleBulb, brightness * 0.5);
                updateBulbBrightness(rightBulb, brightness * 0.3);
            } else if (relativePosition <= 0.66) {
                updateBulbBrightness(leftBulb, brightness * 0.5);
                updateBulbBrightness(middleBulb, brightness);
                updateBulbBrightness(rightBulb, brightness * 0.5);
            } else {
                updateBulbBrightness(leftBulb, brightness * 0.3);
                updateBulbBrightness(middleBulb, brightness * 0.5);
                updateBulbBrightness(rightBulb, brightness);
            }

            ctx.fillStyle = '#fff';
            ctx.font = '14px sans-serif';
            ctx.fillText(`Proximity: ${brightness.toFixed(2)}`, 10, 20);
            ctx.fillText(`Position: ${relativePosition.toFixed(2)}`, 10, 40);
        } else {
            updateBulbBrightness(leftBulb, 0.3);
            updateBulbBrightness(middleBulb, 0.3);
            updateBulbBrightness(rightBulb, 0.3);
        }

        animationId = setTimeout(detectObjects, 100);
    } catch (error) {
        showError('Detection error: ' + error.message);
        stopDetection();
    }
}

function showError(message) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

async function startDetection() {
    try {
        startBtn.disabled = true;
        await startCamera();
        isDetecting = true;
        stopBtn.disabled = false;
        statusDiv.textContent = 'Detection running...';
        errorDiv.style.display = 'none';
        detectObjects();
    } catch (error) {
        startBtn.disabled = false;
        showError('Failed to start detection: ' + error.message);
    }
}

function stopDetection() {
    isDetecting = false;
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    if (animationId) {
        clearTimeout(animationId);
        animationId = null;
    }
    video.srcObject = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    startBtn.disabled = false;
    stopBtn.disabled = true;
    statusDiv.textContent = 'Detection stopped';
    
    updateBulbBrightness(leftBulb, 0.1);
    updateBulbBrightness(middleBulb, 0.1);
    updateBulbBrightness(rightBulb, 0.1);
}

startBtn.addEventListener('click', startDetection);
stopBtn.addEventListener('click', stopDetection);

startBtn.disabled = true;
stopBtn.disabled = true;
loadModel();

window.addEventListener('beforeunload', () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
});
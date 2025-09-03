// --- Constants and State ---
const STORAGE_KEY = "artsFestData";
let allData = {};
const database = firebase.database();
let tempPosterData = null; 
let cropper = null; 
let cameraStream = null; 

// --- DOM Elements ---
const categorySelect = document.getElementById('category-select');
const competitionSelect = document.getElementById('competition-select');
const resultsContainer = document.getElementById('individual-results-container');
const imageUploader = document.getElementById('image-uploader');
const choiceModal = document.getElementById('choice-modal');
const cropperModal = document.getElementById('cropper-modal');
const cameraModal = document.getElementById('camera-modal');

/**
 * NEW: Professional Individual Poster Generator
 * Creates a visually appealing poster for a single winner with randomized themes.
 */
const generateIndividualPoster = (imageSrc, posterData) => {
    const canvas = document.getElementById('poster-canvas');
    canvas.width = 1080;
    canvas.height = 1350; // Portrait format for social media
    const ctx = canvas.getContext('2d');

    const studentImg = new Image();
    studentImg.crossOrigin = "Anonymous";
    const bgImg = new Image();
    bgImg.src = 'bg.png';

    // Array of themes for randomization
    const themes = [
        { bg: ['#000000', '#434343'], accent: '#FFD700', prizeText: '#FFFFFF' }, // Black & Gold
        { bg: ['#141E30', '#243B55'], accent: '#FFFFFF', prizeText: '#F7971E' }, // Deep Blue & Orange
        { bg: ['#3A1C71', '#D76D77', '#FFAF7B'], accent: '#FFFFFF', prizeText: '#FFFFFF' }, // Purple/Pink Gradient
        { bg: ['#16222A', '#3A6073'], accent: '#E0E0E0', prizeText: '#6DD5FA' }  // Dark Teal & Light Blue
    ];
    const selectedTheme = themes[Math.floor(Math.random() * themes.length)];

    // Set the image source before starting to load
    studentImg.src = imageSrc;

    // Wait for both images to load before drawing anything
    Promise.all([
        new Promise((resolve, reject) => { studentImg.onload = resolve; studentImg.onerror = reject; }),
        new Promise((resolve, reject) => { bgImg.onload = resolve; bgImg.onerror = reject; })
    ]).then(() => {
        // 1. Background Gradient
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        selectedTheme.bg.forEach((color, index) => {
            gradient.addColorStop(index / (selectedTheme.bg.length - 1 || 1), color);
        });
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. Subtle Background Image
        ctx.globalAlpha = 0.1;
        ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0;

        // 3. Header Text
        ctx.textAlign = 'center';
        ctx.fillStyle = 'white';
        ctx.font = "90px 'Ramadhan Amazing', sans-serif";
        ctx.fillText("Mehfile RabeeE", canvas.width / 2, 120);
        ctx.font = "60px 'Ramadhan Amazing', sans-serif";
        ctx.fillText("meelad fest", canvas.width / 2, 190);

        // 4. "CONGRATULATIONS" Title
        ctx.font = "bold 60px 'Poppins', sans-serif";
        ctx.fillStyle = selectedTheme.accent;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 10;
        ctx.fillText('CONGRATULATIONS', canvas.width / 2, 300);
        ctx.shadowBlur = 0;

        // 5. Student Image in decorated circle
        const imgCenterY = 540;
        const radius = 180;
        ctx.save();
        ctx.beginPath();
        ctx.arc(canvas.width / 2, imgCenterY, radius + 10, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'; // Faint outer glow
        ctx.fill();
        ctx.beginPath();
        ctx.arc(canvas.width / 2, imgCenterY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = selectedTheme.accent;
        ctx.lineWidth = 8;
        ctx.stroke();
        ctx.clip();
        ctx.drawImage(studentImg, canvas.width / 2 - radius, imgCenterY - radius, radius * 2, radius * 2);
        ctx.restore();

        // 6. Winner's Name (with auto-resize for long names)
        ctx.fillStyle = 'white';
        let winnerFontSize = 100;
        ctx.font = `bold ${winnerFontSize}px 'Poppins', sans-serif`;
        while (ctx.measureText(posterData.name.toUpperCase()).width > canvas.width - 120) {
            winnerFontSize -= 5;
            ctx.font = `bold ${winnerFontSize}px 'Poppins', sans-serif`;
        }
        ctx.fillText(posterData.name.toUpperCase(), canvas.width / 2, 850);

        // 7. Prize Text
        const prizeText = { '1st': 'FIRST PRIZE', '2nd': 'SECOND PRIZE', '3rd': 'THIRD PRIZE' }[posterData.place] || posterData.place.toUpperCase();
        ctx.fillStyle = selectedTheme.prizeText;
        ctx.font = "bold 55px 'Poppins', sans-serif";
        ctx.fillText(prizeText, canvas.width / 2, 950);

        // 8. Competition & Team Name
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = "34px 'Poppins', sans-serif";
        ctx.fillText(posterData.competitionName.toUpperCase(), canvas.width / 2, 1020);
        if (posterData.team) {
            ctx.fillText(`TEAM: ${posterData.team.toUpperCase()}`, canvas.width / 2, 1070);
        }

        // 9. Footer
        ctx.fillStyle = '#FFFFFF';
        ctx.font = "bold 30px 'Poppins', sans-serif";
        ctx.fillText('HAYATHUL ISLAM HIGHER SECONDARY MADRASA', canvas.width / 2, canvas.height - 90);
        ctx.font = "24px 'Poppins', sans-serif";
        ctx.fillText('Muringampurayi, Mukkam', canvas.width / 2, canvas.height - 50);

        // --- Trigger Download ---
        const link = document.createElement('a');
        link.download = `Congratulations-${posterData.name}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

    }).catch(err => {
        console.error("Error loading images for poster:", err);
        alert("Could not load images needed for the poster. Check console for errors.");
    });
};

// --- UI and Data Functions (No changes below this line) ---
const renderSelectedCompetition = () => {
    const selectedCompId = competitionSelect.value;
    resultsContainer.innerHTML = '';
    if (!selectedCompId) {
        resultsContainer.innerHTML = '<p class="no-results-msg">Select a competition to view the results.</p>';
        return;
    }
    const competition = (allData.competitions || []).find(comp => comp.id === selectedCompId);
    if (!competition) return;

    const category = (allData.categories || []).find(cat => cat.id === competition.categoryId);
    const section = document.createElement('section');
    section.innerHTML = `<h3>${competition.name} - ${category ? category.name : 'Unknown'}</h3>`;
    
    const placeOrder = { '1st': 1, '2nd': 2, '3rd': 3 };
    const results = (competition.results || [])
        .filter(r => r.name)
        .sort((a, b) => (placeOrder[a.place] || 99) - (placeOrder[b.place] || 99));

    if (results.length > 0) {
        const table = document.createElement('table');
        table.className = 'result-table';
        table.innerHTML = `<thead><tr><th>Place</th><th>Student</th><th>Class</th><th>Team</th><th>Action</th></tr></thead>`;
        const tbody = document.createElement('tbody');
        results.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${r.place || ''}</td>
                <td>${r.name || ''}</td>
                <td>${r.class || ''}</td>
                <td>${r.team || ''}</td>
                <td>
                    <button class="generate-public-poster-btn" 
                            data-name="${r.name || ''}"
                            data-place="${r.place || ''}"
                            data-team="${r.team || ''}"
                            data-competition-name="${competition.name || ''}">
                        Create Poster
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        section.appendChild(table);
    } else {
        section.innerHTML += '<p class="no-results-msg">No results have been entered for this competition yet.</p>';
    }
    resultsContainer.appendChild(section);
};

const populateCompetitionFilter = () => {
    const selectedCategoryId = categorySelect.value;
    competitionSelect.innerHTML = '<option value="">-- Choose a competition --</option>'; 
    if (!selectedCategoryId) return;
    const competitions = (allData.competitions || [])
        .filter(comp => comp.categoryId === selectedCategoryId && comp.isPublished)
        .sort((a, b) => a.name.localeCompare(b.name));
    competitions.forEach(comp => {
        const option = document.createElement('option');
        option.value = comp.id;
        option.textContent = comp.name;
        competitionSelect.appendChild(option);
    });
};

const populateCategoryFilter = () => {
    const categories = (allData.categories || []).sort((a, b) => a.name.localeCompare(b.name));
    const publishedCompetitions = (allData.competitions || []).filter(c => c.isPublished);
    const categoriesWithPublishedResults = categories.filter(cat => 
        publishedCompetitions.some(comp => comp.categoryId === cat.id)
    );
    categoriesWithPublishedResults.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        categorySelect.appendChild(option);
    });
};

const closeModal = (modal) => {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    modal.classList.add('hidden');
};

const openCropperModal = (imageURL, file) => {
    cropperModal.classList.remove('hidden');
    const image = document.getElementById('image-to-crop');
    image.src = imageURL;
    
    const fileInfo = document.getElementById('file-info');
    if(file) {
        fileInfo.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    } else {
        fileInfo.textContent = 'your captured photo.';
    }

    if (cropper) {
        cropper.destroy();
    }
    cropper = new Cropper(image, {
        aspectRatio: 1,
        viewMode: 1,
        background: false,
        autoCropArea: 1,
    });
};

const openCameraModal = () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Camera access is not supported by your browser.");
        return;
    }
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            cameraModal.classList.remove('hidden');
            const videoElement = document.getElementById('camera-stream');
            videoElement.srcObject = stream;
            cameraStream = stream;
        })
        .catch(err => {
            alert("Could not access the camera. Please ensure you grant permission.");
            console.error("Camera error:", err);
        });
};

const init = () => {
    database.ref(STORAGE_KEY).on('value', (snapshot) => {
        allData = { categories: [], teams: [], competitions: [], ...snapshot.val() };
        populateCategoryFilter();
    });

    categorySelect.addEventListener('change', () => {
        populateCompetitionFilter();
        resultsContainer.innerHTML = '<p class="no-results-msg">Select a competition to view the results.</p>';
    });
    competitionSelect.addEventListener('change', renderSelectedCompetition);

    resultsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('generate-public-poster-btn')) {
            const button = e.target;
            tempPosterData = {
                name: button.dataset.name,
                place: button.dataset.place,
                team: button.dataset.team,
                competitionName: button.dataset.competitionName
            };
            choiceModal.classList.remove('hidden');
        }
    });

    imageUploader.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                openCropperModal(event.target.result, file);
            };
            reader.readAsDataURL(file);
        }
        e.target.value = null; 
    });

    document.getElementById('upload-choice-btn').addEventListener('click', () => {
        closeModal(choiceModal);
        imageUploader.click();
    });

    document.getElementById('camera-choice-btn').addEventListener('click', () => {
        closeModal(choiceModal);
        openCameraModal();
    });
    
    document.getElementById('male-icon-choice-btn').addEventListener('click', () => {
        closeModal(choiceModal);
        generateIndividualPoster('boy.jpg', tempPosterData);
        tempPosterData = null;
    });
    
    document.getElementById('female-icon-choice-btn').addEventListener('click', () => {
        closeModal(choiceModal);
        generateIndividualPoster('girl.jpg', tempPosterData);
        tempPosterData = null;
    });

    document.getElementById('crop-confirm-btn').addEventListener('click', () => {
        if (cropper) {
            const croppedCanvas = cropper.getCroppedCanvas({ width: 500, height: 500 });
            generateIndividualPoster(croppedCanvas.toDataURL(), tempPosterData);
            closeModal(cropperModal);
            tempPosterData = null;
        }
    });
    
    document.getElementById('snapshot-btn').addEventListener('click', () => {
        const videoElement = document.getElementById('camera-stream');
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        canvas.getContext('2d').drawImage(videoElement, 0, 0);
        closeModal(cameraModal);
        openCropperModal(canvas.toDataURL('image/png'), null);
    });

    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = document.getElementById(btn.dataset.modalId);
            closeModal(modal);
        });
    });
};

init();
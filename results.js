// --- Constants and State ---
const STORAGE_KEY = "artsFestData";
let allData = {};
const database = firebase.database();
let tempPosterData = null; // Holds winner data while modals are open
let cropper = null; // Holds the Cropper.js instance
let cameraStream = null; // Holds the camera video stream

// --- DOM Elements ---
const categorySelect = document.getElementById('category-select');
const competitionSelect = document.getElementById('competition-select');
const resultsContainer = document.getElementById('individual-results-container');
const imageUploader = document.getElementById('image-uploader');

// Modals
const choiceModal = document.getElementById('choice-modal');
const cropperModal = document.getElementById('cropper-modal');
const cameraModal = document.getElementById('camera-modal');

// --- Poster Generation Function ---
const generateIndividualPoster = (imageSrc, posterData) => {
    const canvas = document.getElementById('poster-canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');

    const studentImg = new Image();
    studentImg.crossOrigin = "Anonymous";
    studentImg.onload = () => {
        const logo = new Image();
        logo.crossOrigin = "Anonymous";
        logo.src = 'new-logo.png';
        logo.onload = () => {
            // --- Drawing logic remains the same ---
            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, '#008080');
            gradient.addColorStop(1, '#20B2AA');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.beginPath();
            ctx.arc(canvas.width, canvas.height, 300, 0, Math.PI * 2);
            ctx.fill();

            const logoWidth = 120;
            const logoHeight = (logo.height / logo.width) * logoWidth;
            ctx.drawImage(logo, canvas.width - logoWidth - 60, 60, logoWidth, logoHeight);

            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.font = 'bold 130px Poppins, sans-serif';
            ctx.fillText('CONGRAT', canvas.width / 2, 280);
            ctx.fillText('ULATIONS', canvas.width / 2, 400);

            ctx.fillStyle = 'white';
            ctx.font = 'bold 70px Poppins, sans-serif';
            ctx.fillText(posterData.name, canvas.width / 2, 530);

            const prizeText = { '1st': 'First Prize', '2nd': 'Second Prize', '3rd': 'Third Prize' }[posterData.place] || posterData.place;
            ctx.fillStyle = '#FFD700';
            ctx.font = '50px Poppins, sans-serif';
            ctx.fillText(prizeText, canvas.width / 2, 600);
            ctx.fillStyle = 'white';
            ctx.font = 'italic 45px Poppins, sans-serif';
            ctx.fillText(posterData.competitionName, canvas.width / 2, 660);

            const imgY = 900;
            const radius = 200;
            ctx.save();
            ctx.beginPath();
            ctx.arc(canvas.width / 2, imgY, radius, 0, Math.PI * 2);
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 12;
            ctx.stroke();
            ctx.clip();
            ctx.drawImage(studentImg, canvas.width / 2 - radius, imgY - radius, radius * 2, radius * 2);
            ctx.restore();

            ctx.fillStyle = 'white';
            ctx.font = '30px Poppins, sans-serif';
            ctx.fillText('Hayathul Islam Higher Secondary Madrasa, Muringampurayi', canvas.width / 2, canvas.height - 80);

            const link = document.createElement('a');
            link.download = `Congratulations - ${posterData.name}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        };
        logo.onerror = () => alert("Error: Could not load the logo 'new-logo.png'.");
    };
    studentImg.src = imageSrc;
};


// --- UI and Data Functions ---
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
    const results = (competition.results || []).sort((a, b) => parseInt(a.place) - parseInt(b.place));

    if (results.length > 0 && results.some(r => r.name)) {
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
    const publishedCompetitions = allData.competitions.filter(c => c.isPublished);
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

// --- Modal and Feature Functions ---
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
    
    // Display file info
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


// --- Initialization and Event Listeners ---
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

    // Main event listener for poster creation workflow
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

    // Event listener for the image uploader (triggered programmatically)
    imageUploader.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                openCropperModal(event.target.result, file);
            };
            reader.readAsDataURL(file);
        }
        e.target.value = null; // Reset for next use
    });

    // Event listeners for the new choice modal buttons
    document.getElementById('upload-choice-btn').addEventListener('click', () => {
        closeModal(choiceModal);
        imageUploader.click();
    });

    document.getElementById('camera-choice-btn').addEventListener('click', () => {
        closeModal(choiceModal);
        openCameraModal();
    });
    
    document.getElementById('default-icon-choice-btn').addEventListener('click', () => {
        closeModal(choiceModal);
        // A simple SVG for a person icon
        const defaultIconSVG = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2RkZCI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MxLjY2IDAgMyAxLjM0IDMgM3MtMS4zNCAzLTMgMy0zLTEuMzQtMy0zIDEuMzQtMyAzLTN6bTAgMTRjLTIuMzMgMC00LjMyLTEuMDctNS42OC0yLjcxbDEuNDEtMS40MWMxLjEgMS4yMiAyLjU5IDIuMTIgNC4yNyAyLjEyIDIuMDcgMCAzLjk3LS45OSA1LjE5LTIuNTNsMS40MSAxLjQxQzE2LjAxIDIwLjI4IDE0LjAzIDIxIDEyIDIxeiIvPjwvc3ZnPg==`;
        generateIndividualPoster(defaultIconSVG, tempPosterData);
        tempPosterData = null;
    });

    // Event listeners for cropper and camera modals
    document.getElementById('crop-confirm-btn').addEventListener('click', () => {
        if (cropper) {
            const croppedCanvas = cropper.getCroppedCanvas({ width: 400, height: 400 });
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

    // Generic close button listener for all modals
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = document.getElementById(btn.dataset.modalId);
            closeModal(modal);
        });
    });
};

init();
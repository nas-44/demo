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
            // --- Drawing logic with updated design ---

            // 1. Background (Softer, more balanced gradient)
            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, '#ADD8E6'); // Light Blue
            gradient.addColorStop(0.5, '#E0FFFF'); // Light Cyan
            gradient.addColorStop(1, '#ADD8E6'); // Light Blue
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 2. Decorative elements (subtle patterns/shapes)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'; // More subtle white overlay
            ctx.beginPath();
            ctx.moveTo(0, canvas.height * 0.7);
            ctx.bezierCurveTo(canvas.width * 0.2, canvas.height * 0.6, canvas.width * 0.8, canvas.height * 0.8, canvas.width, canvas.height * 0.7);
            ctx.lineTo(canvas.width, canvas.height);
            ctx.lineTo(0, canvas.height);
            ctx.closePath();
            ctx.fill();

            // 3. Fest Logo (top right)
            const logoWidth = 150; // Slightly larger logo
            const logoHeight = (logo.height / logo.width) * logoWidth;
            ctx.drawImage(logo, canvas.width - logoWidth - 50, 50, logoWidth, logoHeight);

            // 4. "CONGRATULATIONS" Text
            ctx.fillStyle = '#4682B4'; // Steel Blue for main text
            ctx.textAlign = 'center';
            ctx.font = 'bold 120px Poppins, sans-serif';
            ctx.fillText('CONGRAT', canvas.width / 2, 280);
            ctx.fillText('ULATIONS', canvas.width / 2, 400);

            // 5. Winner Details
            ctx.fillStyle = '#191970'; // Midnight Blue for name
            ctx.font = 'bold 75px Poppins, sans-serif'; // Slightly larger name
            ctx.fillText(posterData.name, canvas.width / 2, 530);

            const prizeText = { '1st': 'First Prize', '2nd': 'Second Prize', '3rd': 'Third Prize' }[posterData.place] || posterData.place;
            ctx.fillStyle = '#FFD700'; // Gold color for prize
            ctx.font = '60px Poppins, sans-serif'; // Larger prize text
            ctx.fillText(prizeText, canvas.width / 2, 610); // Adjusted position

            ctx.fillStyle = '#6A5ACD'; // Slate Blue for competition name
            ctx.font = 'italic 50px Poppins, sans-serif'; // Larger competition name
            ctx.fillText(posterData.competitionName, canvas.width / 2, 680); // Adjusted position

            // 6. Student Image in a Circle
            const imgY = 950; // Lowered image position slightly
            const radius = 220; // Slightly larger circle
            ctx.save();
            ctx.beginPath();
            ctx.arc(canvas.width / 2, imgY, radius, 0, Math.PI * 2);
            ctx.strokeStyle = '#FFFFFF'; // White border for the circle
            ctx.lineWidth = 15; // Thicker border
            ctx.stroke();
            ctx.clip();
            ctx.drawImage(studentImg, canvas.width / 2 - radius, imgY - radius, radius * 2, radius * 2);
            ctx.restore();

            // 7. Madrasa Name (Footer) - BOLD and Larger
            ctx.fillStyle = '#191970'; // Midnight Blue for footer text
            ctx.textAlign = 'center';
            ctx.font = 'bold 40px Poppins, sans-serif'; // BOLD and larger font size
            ctx.fillText('HAYATHUL ISLAM HIGHER SECONDARY MADRASA,', canvas.width / 2, canvas.height - 80);
            ctx.fillText('Muringampurayi, Mukkam', canvas.width / 2, canvas.height - 30); // Second line for madrasa name

            // --- End Drawing ---

            // 8. Trigger Download
            const link = document.createElement('a');
            link.download = `Congratulations - ${posterData.name}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        };
        logo.onerror = () => alert("Error: Could not load the logo 'new-logo.png'. Make sure it's in the project folder.");
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
            const croppedCanvas = cropper.getCroppedCanvas({ width: 440, height: 440 }); // Adjusted size for potential larger circle
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

// --- Constants and State ---
const STORAGE_KEY = "artsFestData";
let allData = {};
const database = firebase.database();

// --- DOM Elements ---
const categorySelect = document.getElementById('category-select');
const competitionSelect = document.getElementById('competition-select');
const resultsContainer = document.getElementById('individual-results-container');
const canvas = document.getElementById('poster-canvas');
const ctx = canvas.getContext('2d');
const imageUploader = document.getElementById('image-uploader');

// --- Functions ---

const createResultsTable = (results, competitionName) => {
    const table = document.createElement('table');
    table.className = 'result-table';
    let tableHTML = `
        <thead>
            <tr>
                <th>Place</th>
                <th>Student Name</th>
                <th>Team</th>
                <th>Get Poster</th>
            </tr>
        </thead>
        <tbody>`;
    const placesOrder = { '1st': 1, '2nd': 2, '3rd': 3 };
    const sortedResults = results.sort((a, b) => (placesOrder[a.place] || 99) - (placesOrder[b.place] || 99));

    sortedResults.forEach(winner => {
        if (winner.name) {
            tableHTML += `
                <tr>
                    <td>${winner.place}</td>
                    <td>${winner.name}</td>
                    <td>${winner.team || 'N/A'}</td>
                    <td>
                        <button class="create-poster-btn" 
                                data-winner-name="${winner.name}" 
                                data-winner-place="${winner.place}" 
                                data-competition-name="${competitionName}">
                            Create Poster
                        </button>
                    </td>
                </tr>
            `;
        }
    });

    tableHTML += `</tbody>`;
    table.innerHTML = tableHTML;
    return table;
};

const loadImage = (src) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.src = src;
    });
};

const generatePoster = async (winnerDetails, imageFile) => {
    const { winnerName, winnerPlace, competitionName } = winnerDetails;
    const studentImageUrl = URL.createObjectURL(imageFile);

    try {
        const [logoImg, studentImg] = await Promise.all([
            loadImage('aaa.png'),
            loadImage(studentImageUrl)
        ]);

        canvas.width = 1080;
        canvas.height = 1350;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#008080';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.moveTo(0, 800);
        ctx.quadraticCurveTo(canvas.width / 2, 650, canvas.width, 850);
        ctx.lineTo(canvas.width, canvas.height);
        ctx.lineTo(0, canvas.height);
        ctx.closePath();
        ctx.fill();

        ctx.drawImage(logoImg, canvas.width - logoImg.width - 50, 50);

        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.font = 'bold 120px sans-serif';
        ctx.fillText('CONGRATULATIONS', canvas.width / 2, 250);

        ctx.font = '40px sans-serif';
        ctx.fillText('MEHFILE RABEEH MEELAD FEST', canvas.width / 2, 320);

        const centerX = canvas.width / 2;
        const centerY = 550;
        const radius = 200;
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + 10, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(studentImg, centerX - radius, centerY - radius, radius * 2, radius * 2);
        ctx.restore();

        ctx.fillStyle = '#ffde00';
        ctx.font = 'bold 50px sans-serif';
        ctx.fillText(winnerPlace, centerX, centerY + radius + 100);

        ctx.fillStyle = 'white';
        ctx.font = 'bold 70px sans-serif';
        ctx.fillText(winnerName, centerX, centerY + radius + 180);

        ctx.font = '40px sans-serif';
        ctx.fillText(competitionName, centerX, centerY + radius + 240);
        
        ctx.font = '30px sans-serif';
        ctx.fillText('Hayathul Islam Higher Secondary Madrasa', centerX, canvas.height - 100);

        const link = document.createElement('a');
        link.download = `${winnerName} - Congratulations.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

    } catch (error) {
        console.error("Poster generation error:", error);
        alert("Sorry, the poster could not be created. The image file might be invalid.");
    } finally {
        URL.revokeObjectURL(studentImageUrl);
    }
};

const handlePosterButtonClick = (e) => {
    if (!e.target.classList.contains('create-poster-btn')) return;
    imageUploader.dataset.winnerDetails = JSON.stringify(e.target.dataset);
    imageUploader.click();
};

const handleImageUpload = (e) => {
    const file = e.target.files[0];
    const winnerDetails = JSON.parse(e.target.dataset.winnerDetails || '{}');
    if (file && winnerDetails) {
        generatePoster(winnerDetails, file);
    }
    e.target.value = null; 
};

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
    const results = competition.results || [];
    if (results.length > 0 && results.some(r => r.name)) {
        section.appendChild(createResultsTable(results, competition.name));
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
    if (competitions.length === 0) {
        resultsContainer.innerHTML = '<p class="no-results-msg">There are no published competitions for this category yet.</p>';
    }
    competitions.forEach(comp => {
        const option = document.createElement('option');
        option.value = comp.id;
        option.textContent = comp.name;
        competitionSelect.appendChild(option);
    });
};

const populateCategoryFilter = () => {
    const categories = (allData.categories || []).sort((a, b) => a.name.localeCompare(b.name));
    categorySelect.innerHTML = '<option value="">-- Choose a category --</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        categorySelect.appendChild(option);
    });
};

const init = () => {
    database.ref(STORAGE_KEY).on('value', (snapshot) => {
        const firebaseData = snapshot.val();
        const defaultData = { categories: [], teams: [], competitions: [] };
        allData = { ...defaultData, ...firebaseData };
        populateCategoryFilter();
    });

    categorySelect.addEventListener('change', () => {
        populateCompetitionFilter();
        resultsContainer.innerHTML = '<p class="no-results-msg">Select a competition to view the results.</p>';
    });
    competitionSelect.addEventListener('change', renderSelectedCompetition);
    resultsContainer.addEventListener('click', handlePosterButtonClick);
    imageUploader.addEventListener('change', handleImageUpload);
};

init();
// --- Constants and State ---
const STORAGE_KEY = "artsFestData";
let allData = {};
const database = firebase.database();
let tempPosterData = null; // Holds winner data temporarily for poster generation

// --- DOM Elements ---
const categorySelect = document.getElementById('category-select');
const competitionSelect = document.getElementById('competition-select');
const resultsContainer = document.getElementById('individual-results-container');
const imageUploader = document.getElementById('image-uploader');


// --- Poster Generation Function ---
/**
 * NEW: Generates a personalized poster for an individual winner.
 * This function is now part of the public results page.
 * @param {File} imageFile The image file for the student.
 * @param {object} posterData The winner's details { name, place, team, competitionName }.
 */
const generateIndividualPoster = (imageFile, posterData) => {
    const canvas = document.getElementById('poster-canvas');
    // Set canvas dimensions if not set in HTML
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');

    const reader = new FileReader();
    reader.onload = (event) => {
        const studentImg = new Image();
        studentImg.onload = () => {
            const logo = new Image();
            logo.crossOrigin = "Anonymous";
            logo.src = 'new-logo.png'; // Use the fest logo from your files
            logo.onload = () => {
                // --- Start Drawing on Canvas ---

                // 1. Background (Teal gradient like the reference)
                const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
                gradient.addColorStop(0, '#008080'); // Darker Teal
                gradient.addColorStop(1, '#20B2AA'); // Lighter Sea Green
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // 2. Decorative elements (simple sun glow)
                ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
                ctx.beginPath();
                ctx.arc(canvas.width, canvas.height, 300, 0, Math.PI * 2);
                ctx.fill();

                // 3. Fest Logo (top right)
                const logoWidth = 120;
                const logoHeight = (logo.height / logo.width) * logoWidth;
                ctx.drawImage(logo, canvas.width - logoWidth - 60, 60, logoWidth, logoHeight);

                // 4. "CONGRATULATIONS" Text
                ctx.fillStyle = 'white';
                ctx.textAlign = 'center';
                ctx.font = 'bold 130px Poppins, sans-serif';
                ctx.fillText('CONGRAT', canvas.width / 2, 280);
                ctx.fillText('ULATIONS', canvas.width / 2, 400);

                // 5. Winner Details
                ctx.fillStyle = 'white';
                ctx.font = 'bold 70px Poppins, sans-serif';
                ctx.fillText(posterData.name, canvas.width / 2, 530);

                const prizeText = { '1st': 'First Prize', '2nd': 'Second Prize', '3rd': 'Third Prize' }[posterData.place] || posterData.place;
                
                ctx.fillStyle = '#FFD700'; // Gold color for prize
                ctx.font = '50px Poppins, sans-serif';
                ctx.fillText(prizeText, canvas.width / 2, 600);
                
                ctx.fillStyle = 'white';
                ctx.font = 'italic 45px Poppins, sans-serif';
                ctx.fillText(posterData.competitionName, canvas.width / 2, 660);

                // 6. Student Image in a Circle
                const imgY = 900;
                const radius = 200;
                ctx.save();
                ctx.beginPath();
                ctx.arc(canvas.width / 2, imgY, radius, 0, Math.PI * 2);
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 12;
                ctx.stroke();
                ctx.clip();
                
                // Logic to draw image to "cover" the circle area
                const aspect = studentImg.width / studentImg.height;
                let drawWidth, drawHeight, drawX, drawY;
                if (aspect > 1) { // Landscape
                    drawHeight = radius * 2;
                    drawWidth = drawHeight * aspect;
                } else { // Portrait
                    drawWidth = radius * 2;
                    drawHeight = drawWidth / aspect;
                }
                drawX = canvas.width / 2 - drawWidth / 2;
                drawY = imgY - drawHeight / 2;
                ctx.drawImage(studentImg, drawX, drawY, drawWidth, drawHeight);
                ctx.restore();

                // 7. Madrasa Name (Footer)
                ctx.fillStyle = 'white';
                ctx.font = '30px Poppins, sans-serif';
                ctx.fillText('Hayathul Islam Higher Secondary Madrasa, Muringampurayi', canvas.width / 2, canvas.height - 80);

                // --- End Drawing ---

                // 8. Trigger Download
                const link = document.createElement('a');
                link.download = `Congratulations - ${posterData.name}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            };
            logo.onerror = () => alert("Error: Could not load the logo. Make sure 'new-logo.png' is in the project folder.");
        };
        studentImg.src = event.target.result;
    };
    reader.readAsDataURL(imageFile);
};


/**
 * MODIFIED: Renders the competition results table with a "Create Poster" button for each winner.
 */
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
    const sortedResults = results.sort((a, b) => parseInt(a.place) - parseInt(b.place));

    if (sortedResults.length > 0 && sortedResults.some(r => r.name)) {
        const table = document.createElement('table');
        table.className = 'result-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Place</th>
                    <th>Student</th>
                    <th>Class</th>
                    <th>Team</th>
                    <th>Action</th>
                </tr>
            </thead>
        `;
        const tbody = document.createElement('tbody');
        sortedResults.forEach(r => {
            const tr = document.createElement('tr');
            // Using template literals to safely handle potential null/undefined values
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

    // NEW: Event listener for public poster buttons
    resultsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('generate-public-poster-btn')) {
            const button = e.target;
            tempPosterData = {
                name: button.dataset.name,
                place: button.dataset.place,
                team: button.dataset.team,
                competitionName: button.dataset.competitionName
            };
            imageUploader.click();
        }
    });

    // NEW: Event listener for the image uploader
    imageUploader.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && tempPosterData) {
            generateIndividualPoster(file, tempPosterData);
        }
        e.target.value = null;
        tempPosterData = null;
    });
};

init();
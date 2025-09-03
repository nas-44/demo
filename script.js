// --- Data and Constants ---
const ADMIN_PASSWORD = "nas";
const STORAGE_KEY = "artsFestData";
const SCORE_POINTS = { '1st': 10, '2nd': 7, '3rd': 5 };

// --- DOM Elements ---
const adminLoginBtn = document.getElementById('admin-login-btn');
const adminPanel = document.getElementById('admin-panel');
const publicView = document.getElementById('public-view');
const loginForm = document.getElementById('login-form');
const adminPasswordInput = document.getElementById('admin-password');
const adminContent = document.getElementById('admin-content');
const addCategoryBtn = document.getElementById('add-category-btn');
const addTeamBtn = document.getElementById('add-team-btn');
const addCategoryForm = document.getElementById('add-category-form');
const addTeamForm = document.getElementById('add-team-form');
const categoryNameInput = document.getElementById('category-name-input');
const teamNameInput = document.getElementById('team-name-input');
const submitCategoryBtn = document.getElementById('submit-category-btn');
const submitTeamBtn = document.getElementById('submit-team-btn');
const categoryTabsContainer = document.getElementById('category-tabs-container');
const competitionEntry = document.getElementById('competition-entry');
const currentCategoryTitle = document.getElementById('current-category-title');
const addCompetitionForm = document.getElementById('add-competition-form');
const competitionNameInput = document.getElementById('competition-name-input');
const competitionsList = document.getElementById('competitions-list');
const resultsContainer = document.getElementById('results-container');
const backToPublicBtn = document.getElementById('back-to-public-btn');

// --- Global State ---
let data = {};
let currentCategory = null;
const database = firebase.database();

// --- Helper Functions ---
const generateUniqueId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);
const saveData = () => database.ref(STORAGE_KEY).set(data);

// --- Rendering Functions ---

const renderCategoryTabs = () => {
    categoryTabsContainer.innerHTML = '';
    (data.categories || []).forEach(category => {
        const tab = document.createElement('div');
        tab.className = 'category-tab';
        tab.textContent = category.name;
        tab.dataset.id = category.id;
        if (currentCategory && category.id === currentCategory.id) tab.classList.add('active');

        tab.addEventListener('click', () => {
            currentCategory = category;
            renderCategoryTabs();
            renderCompetitions();
            competitionEntry.classList.remove('hidden');
            currentCategoryTitle.textContent = `Competitions for: ${category.name}`;
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'X';
        deleteBtn.style.marginLeft = '10px';
        deleteBtn.style.backgroundColor = '#dc3545';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Delete "${category.name}" and all its competitions?`)) deleteCategory(category.id);
        });
        tab.appendChild(deleteBtn);
        categoryTabsContainer.appendChild(tab);
    });
};

const renderCompetitions = () => {
    competitionsList.innerHTML = '';
    if (!currentCategory) return;
    const categoryCompetitions = (data.competitions || []).filter(comp => comp.categoryId === currentCategory.id);
    categoryCompetitions.forEach(comp => {
        const isPublished = comp.isPublished || false;
        const publishBtnText = isPublished ? 'Unpublish' : 'Publish';
        const publishBtnClass = isPublished ? 'unpublish-btn' : 'publish-btn';

        const compCard = document.createElement('div');
        compCard.className = 'competition-card';
        compCard.innerHTML = `
            <h4>${comp.name}</h4>
            <div class="edit-delete-buttons">
                <button class="generate-competition-poster-btn" data-id="${comp.id}">List Poster</button>
                <button class="${publishBtnClass}" data-id="${comp.id}">${publishBtnText}</button>
                <button class="edit-comp-btn" data-id="${comp.id}">Edit Name</button>
                <button class="delete-comp-btn" data-id="${comp.id}">Delete</button>
            </div>
            <div class="result-entry-form" data-id="${comp.id}">
                ${renderResultRows(comp)}
                <button class="save-all-results-btn" data-id="${comp.id}">Save All Results</button>
            </div>
        `;
        competitionsList.appendChild(compCard);
    });
};

const renderResultRows = (competition) => {
    let html = '';
    const places = ['1st', '2nd', '3rd'];
    places.forEach(place => {
        const result = (competition.results || []).find(r => r.place === place) || { name: '', class: '', team: '' };
        html += `
            <div class="student-row" data-place="${place}">
                <label>${place}:</label>
                <input type="text" class="student-name-input" placeholder="Student Name" value="${result.name}">
                <input type="text" class="student-class-input" placeholder="Class" value="${result.class}">
                <select class="student-team-select">
                    <option value="">Select Team</option>
                    ${(data.teams || []).map(team => `<option value="${team.name}" ${team.name === result.team ? 'selected' : ''}>${team.name}</option>`).join('')}
                </select>
            </div>
        `;
    });
    return html;
};


// --- Public View Logic ---

const calculateTeamScores = () => {
    const teamScores = {};
    (data.teams || []).forEach(team => teamScores[team.name] = 0);
    const categoryScores = {};
    (data.categories || []).forEach(category => {
        categoryScores[category.name] = {};
        (data.teams || []).forEach(team => categoryScores[category.name][team.name] = 0);
    });
    const publishedCompetitions = (data.competitions || []).filter(comp => comp.isPublished);
    publishedCompetitions.forEach(comp => {
        const category = (data.categories || []).find(cat => cat.id === comp.categoryId);
        if (!category) return;
        (comp.results || []).forEach(result => {
            const points = SCORE_POINTS[result.place];
            if (points && result.team && teamScores.hasOwnProperty(result.team)) {
                teamScores[result.team] += points;
                categoryScores[category.name][result.team] += points;
            }
        });
    });
    const sortScores = scores => Object.entries(scores).sort(([, a], [, b]) => b - a);
    return {
        overall: sortScores(teamScores),
        categories: Object.keys(categoryScores).reduce((acc, cat) => ({...acc, [cat]: sortScores(categoryScores[cat])}), {})
    };
};

const renderPublicView = () => {
    const scores = calculateTeamScores();
    resultsContainer.innerHTML = '';
    const createTable = (headers, rows) => {
        const table = document.createElement('table');
        table.className = 'result-table';
        table.innerHTML = `
            <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
        `;
        return table;
    };
    const overallSection = document.createElement('section');
    overallSection.innerHTML = '<h3>Overall Team Leaderboard</h3>';
    if (scores.overall.length > 0 && scores.overall.some(s => s[1] > 0)) {
        const rows = scores.overall.map(([team, score], i) => [i + 1, team, score]);
        overallSection.appendChild(createTable(['Rank', 'Team', 'Score'], rows));
    } else {
        overallSection.innerHTML += '<p class="no-results-msg">No published results to display.</p>';
    }
    resultsContainer.appendChild(overallSection);
    Object.keys(scores.categories).forEach(catName => {
        const catSection = document.createElement('section');
        catSection.innerHTML = `<h3>${catName} Leaderboard</h3>`;
        const catScores = scores.categories[catName].filter(([, score]) => score > 0);
        if (catScores.length > 0) {
            const rows = catScores.map(([team, score], i) => [i + 1, team, score]);
            catSection.appendChild(createTable(['Rank', 'Team', 'Score'], rows));
        } else {
            catSection.innerHTML += `<p class="no-results-msg">No published results for ${catName} yet.</p>`;
        }
        resultsContainer.appendChild(catSection);
    });
};

// --- Admin Actions ---

/**
 * NEW: Professional Competition Poster Generator with Enhanced Designs
 * Creates a visually appealing poster for a competition's winners with randomized, diverse themes.
 */
const generateCompetitionPoster = (compId) => {
    const competition = (data.competitions || []).find(c => c.id === compId);
    const category = (data.categories || []).find(c => c.id === competition.categoryId);
    if (!competition) {
        alert("Competition data not found.");
        return;
    }

    const canvas = document.getElementById('poster-canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');

    // Load ALL potential background images
    const domeImg = new Image();
    domeImg.src = 'dome.png'; 
    const bgPatternImg = new Image();
    bgPatternImg.src = 'bg.png';
    const mosqueBg1Img = new Image();
    mosqueBg1Img.src = 'mosque_bg_1.jpg'; // Your first new image
    const mosqueBg2Img = new Image();
    mosqueBg2Img.src = 'mosque_bg_2.jpg'; // Your second new image

    // Enhanced Themes Array
    const themes = [
        // Theme 1: Dark Blue/Gold - Original style (with dome.png)
        { 
            name: "Original Dome Dark",
            bg: ['#232526', '#414345'], accent: '#FFD700', 
            primaryBgImage: domeImg, primaryBgAlpha: 0.15, primaryBgOffset: 150, 
            headerY: 120, festY: 170, categoryY: 240, winnersY: 380, listStartY: 520, 
            hasPatternOverlay: false,
            rankCircleColor: null // Default to accent
        },
        // Theme 2: Radiant Gradient with Subtle Texture (with bg.png)
        { 
            name: "Radiant Texture",
            bg: ['#121212', '#333333', '#555555'], accent: '#00F0FF', 
            primaryBgImage: bgPatternImg, primaryBgAlpha: 0.1, primaryBgOffset: 0, 
            headerY: 120, festY: 170, categoryY: 240, winnersY: 380, listStartY: 520, 
            hasPatternOverlay: false, // bgPatternImg is the primary here
            rankCircleColor: 'rgba(0, 240, 255, 0.2)' 
        },
        // Theme 3: Deep Purple & Pink with Abstract Shape (no specific image)
        { 
            name: "Abstract Purple",
            bg: ['#3A1C71', '#D76D77', '#FFAF7B'], accent: '#FFEFB3', 
            primaryBgImage: null, primaryBgAlpha: 0, primaryBgOffset: 0, 
            abstractShape: true, 
            headerY: 100, festY: 150, categoryY: 210, winnersY: 330, listStartY: 480, 
            hasPatternOverlay: false,
            rankCircleColor: null
        },
        // Theme 4: Modern Dark with Sharp Lines (subtle dome.png)
        { 
            name: "Modern Lines",
            bg: ['#0A0A0A', '#1A1A1A'], accent: '#A0FF90', 
            primaryBgImage: domeImg, primaryBgAlpha: 0.05, primaryBgOffset: 200, 
            headerY: 110, festY: 160, categoryY: 230, winnersY: 360, listStartY: 500, 
            hasPatternOverlay: false,
            decorativeLines: true,
            rankCircleColor: null
        },
        // NEW Theme 5: Using mosque_bg_1.jpg as a subtle background
        {
            name: "Mosque BG 1 Subtle",
            bg: ['#0C1420', '#1A293A'], accent: '#FFEB00',
            primaryBgImage: mosqueBg1Img, primaryBgAlpha: 0.1, primaryBgOffset: 0,
            primaryBgMode: 'cover', // Scale to cover the canvas
            headerY: 120, festY: 170, categoryY: 240, winnersY: 380, listStartY: 520,
            hasPatternOverlay: false,
            rankCircleColor: 'rgba(255, 235, 0, 0.2)'
        },
        // NEW Theme 6: Using mosque_bg_2.jpg with a darker overlay
        {
            name: "Mosque BG 2 Overlay",
            bg: ['#000000', '#1C0000'], accent: '#EEA236', // Deep red/black with orange accent
            primaryBgImage: mosqueBg2Img, primaryBgAlpha: 0.2, primaryBgOffset: 0,
            primaryBgMode: 'cover',
            headerY: 120, festY: 170, categoryY: 240, winnersY: 380, listStartY: 520,
            hasPatternOverlay: true, patternAlpha: 0.05, // Can combine with bg.png if desired
            rankCircleColor: 'rgba(238, 162, 54, 0.3)'
        },
        // NEW Theme 7: Mosque BG 1 prominent, with color shift
        {
            name: "Mosque BG 1 Prominent",
            bg: ['#000D1A', '#000000'], accent: '#FFFFFF', // Very dark blue/black
            primaryBgImage: mosqueBg1Img, primaryBgAlpha: 0.35, primaryBgOffset: 0,
            primaryBgMode: 'cover',
            primaryBgFilter: 'grayscale(60%) brightness(80%)', // Apply filter for effect
            headerY: 120, festY: 170, categoryY: 240, winnersY: 380, listStartY: 520,
            hasPatternOverlay: false,
            rankCircleColor: 'rgba(255, 255, 255, 0.2)'
        }
    ];
    const selectedTheme = themes[Math.floor(Math.random() * themes.length)];

    // Load images and then draw
    Promise.all([
        new Promise(resolve => { domeImg.onload = resolve; domeImg.onerror = resolve; }), 
        new Promise(resolve => { bgPatternImg.onload = resolve; bgPatternImg.onerror = resolve; }),
        new Promise(resolve => { mosqueBg1Img.onload = resolve; mosqueBg1Img.onerror = resolve; }),
        new Promise(resolve => { mosqueBg2Img.onload = resolve; mosqueBg2Img.onerror = resolve; })
    ]).then(() => {
        // 1. Background Gradient
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        selectedTheme.bg.forEach((color, index) => {
            gradient.addColorStop(index / (selectedTheme.bg.length - 1 || 1), color);
        });
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. Primary Background Image (Mosque images or dome/pattern as per theme)
        if (selectedTheme.primaryBgImage && selectedTheme.primaryBgImage.complete && selectedTheme.primaryBgImage.naturalWidth > 0) {
            ctx.save(); // Save context to apply transformations/filters
            ctx.globalAlpha = selectedTheme.primaryBgAlpha;

            // Apply filters if specified
            if (selectedTheme.primaryBgFilter) {
                ctx.filter = selectedTheme.primaryBgFilter;
            }

            if (selectedTheme.primaryBgMode === 'cover') {
                const img = selectedTheme.primaryBgImage;
                const imgAspectRatio = img.naturalWidth / img.naturalHeight;
                const canvasAspectRatio = canvas.width / canvas.height;

                let sx, sy, sWidth, sHeight; // Source rectangle
                let dx, dy, dWidth, dHeight; // Destination rectangle

                if (imgAspectRatio > canvasAspectRatio) { // Image is wider than canvas
                    sHeight = img.naturalHeight;
                    sWidth = sHeight * canvasAspectRatio;
                    sx = (img.naturalWidth - sWidth) / 2;
                    sy = 0;
                } else { // Image is taller than canvas
                    sWidth = img.naturalWidth;
                    sHeight = sWidth / canvasAspectRatio;
                    sx = 0;
                    sy = (img.naturalHeight - sHeight) / 2;
                }

                dx = 0;
                dy = selectedTheme.primaryBgOffset || 0; // Use offset for destination Y
                dWidth = canvas.width;
                dHeight = canvas.height;

                ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
            } else { // Default behavior (for dome.png specifically)
                const img = selectedTheme.primaryBgImage;
                const imgWidth = 800; // Consistent width for dome
                const imgHeight = imgWidth * (img.naturalHeight / img.naturalWidth);
                ctx.drawImage(img, (canvas.width - imgWidth) / 2, canvas.height - imgHeight + (selectedTheme.primaryBgOffset || 0), imgWidth, imgHeight);
            }
            
            ctx.restore(); // Restore context to remove filters/transformations
            ctx.globalAlpha = 1.0; // Reset alpha
        }

        // 3. Optional Pattern Overlay (using bg.png if not primary)
        if (selectedTheme.hasPatternOverlay && bgPatternImg.complete && bgPatternImg.naturalWidth > 0 && selectedTheme.primaryBgImage !== bgPatternImg) {
            ctx.globalAlpha = selectedTheme.patternAlpha;
            ctx.drawImage(bgPatternImg, 0, 0, canvas.width, canvas.height);
            ctx.globalAlpha = 1.0;
        }

        // 4. Optional Abstract Shape
        if (selectedTheme.abstractShape) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.beginPath();
            ctx.moveTo(0, canvas.height / 2);
            ctx.quadraticCurveTo(canvas.width / 4, canvas.height / 4, canvas.width / 2, canvas.height / 2);
            ctx.quadraticCurveTo(canvas.width * 3 / 4, canvas.height * 3 / 4, canvas.width, canvas.height / 2);
            ctx.lineTo(canvas.width, canvas.height);
            ctx.lineTo(0, canvas.height);
            ctx.closePath();
            ctx.fill();
        }

        // 5. Decorative Lines (if applicable for theme)
        if (selectedTheme.decorativeLines) {
            ctx.strokeStyle = selectedTheme.accent;
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.moveTo(0, 200);
            ctx.lineTo(canvas.width, 220);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, canvas.height - 200);
            ctx.lineTo(canvas.width, canvas.height - 180);
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        }

        // 6. Header Text
        ctx.textAlign = 'center';
        ctx.fillStyle = 'white';
        ctx.font = "80px 'Ramadhan Amazing', sans-serif";
        ctx.fillText("Mehfile RabeeE", canvas.width / 2, selectedTheme.headerY);
        ctx.font = "40px 'Ramadhan Amazing', sans-serif";
        ctx.fillText("meelad fest", canvas.width / 2, selectedTheme.festY);

        // 7. Category & Competition Name
        ctx.font = "bold 28px 'Poppins', sans-serif";
        ctx.fillStyle = '#CCCCCC';
        ctx.fillText(`${category.name.toUpperCase()} - ${competition.name.toUpperCase()}`, canvas.width / 2, selectedTheme.categoryY);

        // 8. "WINNERS" Title
        ctx.font = "bold 130px 'Poppins', sans-serif";
        ctx.fillStyle = selectedTheme.accent;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;
        ctx.fillText('WINNERS', canvas.width / 2, selectedTheme.winnersY);
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // 9. Winners List
        const placeOrder = { '1st': 1, '2nd': 2, '3rd': 3 };
        const sortedResults = (competition.results || [])
            .filter(r => r.name)
            .sort((a, b) => (placeOrder[a.place] || 99) - (placeOrder[b.place] || 99));

        let startY = selectedTheme.listStartY;
        const itemHeight = 150;
        
        sortedResults.forEach((winner) => {
            ctx.fillStyle = selectedTheme.rankCircleColor || selectedTheme.accent; // Use specific rank color if defined
            ctx.beginPath();
            ctx.arc(220, startY - 20, 45, 0, 2 * Math.PI);
            ctx.fill();

            const rankNumber = winner.place.charAt(0);
            ctx.fillStyle = selectedTheme.bg[0]; // Text color inside circle
            ctx.font = "bold 50px 'Poppins', sans-serif";
            ctx.textAlign = 'center';
            ctx.fillText(rankNumber, 220, startY - 5);

            ctx.fillStyle = 'white';
            ctx.textAlign = 'left';
            ctx.font = "60px 'Poppins', sans-serif";
            ctx.fillText(winner.name.toUpperCase(), 300, startY);

            ctx.font = "30px 'Poppins', sans-serif";
            ctx.fillStyle = '#DDDDDD';
            ctx.fillText((winner.team || '').toUpperCase(), 300, startY + 40);

            startY += itemHeight;
        });

        // 10. Footer
        ctx.textAlign = 'center';
        ctx.fillStyle = 'white';
        ctx.font = "bold 24px 'Poppins', sans-serif";
        ctx.fillText('HAYATHUL ISLAM HIGHER SECONDARY MADRASA', canvas.width / 2, canvas.height - 80);
        ctx.font = "20px 'Poppins', sans-serif";
        ctx.fillText('Muringampurayi, Mukkam', canvas.width / 2, canvas.height - 50);

        // --- Trigger Download ---
        const link = document.createElement('a');
        link.download = `Winners - ${competition.name}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
};


const handlePublishToggle = (id) => {
    const comp = (data.competitions || []).find(c => c.id == id);
    if (comp) {
        comp.isPublished = !comp.isPublished;
        saveData();
        const action = comp.isPublished ? "published" : "hidden";
        alert(`Competition "${comp.name}" is now ${action}.`);
    }
};

const deleteCategory = (id) => {
    data.categories = (data.categories || []).filter(cat => cat.id !== id);
    data.competitions = (data.competitions || []).filter(comp => comp.categoryId !== id);
    if (currentCategory && currentCategory.id === id) {
        currentCategory = null;
        competitionEntry.classList.add('hidden');
    }
    saveData();
    alert("Category deleted.");
};

const handleEditCompetition = (id) => {
    const comp = (data.competitions || []).find(c => c.id == id);
    if (comp) {
        const newName = prompt("Enter new name:", comp.name);
        if (newName && newName.trim()) {
            comp.name = newName.trim();
            saveData();
            alert("Competition updated.");
        }
    }
};

const handleDeleteCompetition = (id) => {
    if (confirm("Delete this competition?")) {
        data.competitions = (data.competitions || []).filter(comp => comp.id != id);
        saveData();
        alert("Competition deleted.");
    }
};

const handleSaveAllResults = (compId) => {
    const comp = (data.competitions || []).find(c => c.id == compId);
    if (!comp) return;
    const resultForm = document.querySelector(`.result-entry-form[data-id="${compId}"]`);
    const studentRows = resultForm.querySelectorAll('.student-row');
    const newResults = [];
    studentRows.forEach(row => {
        const name = row.querySelector('.student-name-input').value.trim();
        if (name) {
            newResults.push({
                place: row.dataset.place,
                name: name,
                class: row.querySelector('.student-class-input').value.trim(),
                team: row.querySelector('.student-team-select').value
            });
        }
    });
    comp.results = newResults;
    saveData();
    alert(`Results for "${comp.name}" saved.`);
};

// --- Event Listeners Setup ---
const setupEventListeners = () => {
    const toggleAdminView = () => {
        adminPanel.classList.toggle('hidden');
        publicView.classList.toggle('hidden');
    };
    adminLoginBtn.addEventListener('click', toggleAdminView);
    backToPublicBtn.addEventListener('click', toggleAdminView);

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (adminPasswordInput.value === ADMIN_PASSWORD) {
            loginForm.classList.add('hidden');
            adminContent.classList.remove('hidden');
        } else {
            alert("Incorrect password.");
        }
        adminPasswordInput.value = '';
    });

    addCategoryBtn.addEventListener('click', () => addCategoryForm.classList.toggle('hidden'));
    addTeamBtn.addEventListener('click', () => addTeamForm.classList.toggle('hidden'));

    submitCategoryBtn.addEventListener('click', () => {
        const name = categoryNameInput.value.trim();
        if (name) {
            if (!data.categories) data.categories = [];
            data.categories.push({ id: generateUniqueId(), name });
            saveData();
            categoryNameInput.value = '';
        }
    });

    submitTeamBtn.addEventListener('click', () => {
        const name = teamNameInput.value.trim();
        if (name) {
            if (!data.teams) data.teams = [];
            data.teams.push({ id: generateUniqueId(), name });
            saveData();
            teamNameInput.value = '';
        }
    });

    addCompetitionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = competitionNameInput.value.trim();
        if (name && currentCategory) {
            if (!data.competitions) data.competitions = [];
            data.competitions.push({ id: generateUniqueId(), categoryId: currentCategory.id, name, results: [], isPublished: false });
            saveData();
            competitionNameInput.value = '';
        }
    });

    document.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('close-form-btn')) {
            document.getElementById(target.dataset.form).classList.add('hidden');
        }
        const compId = target.dataset.id;
        if (target.classList.contains('publish-btn') || target.classList.contains('unpublish-btn')) handlePublishToggle(compId);
        if (target.classList.contains('edit-comp-btn')) handleEditCompetition(compId);
        if (target.classList.contains('delete-comp-btn')) handleDeleteCompetition(compId);
        if (target.classList.contains('save-all-results-btn')) handleSaveAllResults(compId);
        
        if (target.classList.contains('generate-competition-poster-btn')) {
            generateCompetitionPoster(compId);
        }
    });
};

// --- Initialization ---
const init = () => {
    database.ref(STORAGE_KEY).on('value', (snapshot) => {
        const firebaseData = snapshot.val();
        const defaultData = { categories: [], teams: [], competitions: [] };
        data = { ...defaultData, ...firebaseData };
        
        renderCategoryTabs();
        renderPublicView();
        if (currentCategory) {
            const categoryStillExists = (data.categories || []).some(c => c.id === currentCategory.id);
            if (categoryStillExists) {
                renderCompetitions();
            } else {
                currentCategory = null;
                competitionEntry.classList.add('hidden');
            }
        }
    });
    setupEventListeners();
};

init();
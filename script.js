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

const generateCompetitionPoster = (compId) => {
    // This function remains the same as the previous version
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
    const domeImg = new Image();
    domeImg.src = 'dome.png';
    const bgPatternImg = new Image();
    bgPatternImg.src = 'bg.png';
    const mosqueBg1Img = new Image();
    mosqueBg1Img.src = 'mosque_bg_1.jpg';
    const mosqueBg2Img = new Image();
    mosqueBg2Img.src = 'mosque_bg_2.jpg';
    const themes = [
        { name: "Original Dome Dark", bg: ['#232526', '#414345'], accent: '#FFD700', primaryBgImage: domeImg, primaryBgAlpha: 0.15, primaryBgOffset: 150, headerY: 120, festY: 170, categoryY: 240, winnersY: 380, listStartY: 520, hasPatternOverlay: false, rankCircleColor: null },
        { name: "Radiant Texture", bg: ['#121212', '#333333', '#555555'], accent: '#00F0FF', primaryBgImage: bgPatternImg, primaryBgAlpha: 0.1, primaryBgOffset: 0, headerY: 120, festY: 170, categoryY: 240, winnersY: 380, listStartY: 520, hasPatternOverlay: false, rankCircleColor: 'rgba(0, 240, 255, 0.2)' },
        { name: "Abstract Purple", bg: ['#3A1C71', '#D76D77', '#FFAF7B'], accent: '#FFEFB3', primaryBgImage: null, primaryBgAlpha: 0, primaryBgOffset: 0, abstractShape: true, headerY: 100, festY: 150, categoryY: 210, winnersY: 330, listStartY: 480, hasPatternOverlay: false, rankCircleColor: null },
        { name: "Modern Lines", bg: ['#0A0A0A', '#1A1A1A'], accent: '#A0FF90', primaryBgImage: domeImg, primaryBgAlpha: 0.05, primaryBgOffset: 200, headerY: 110, festY: 160, categoryY: 230, winnersY: 360, listStartY: 500, hasPatternOverlay: false, decorativeLines: true, rankCircleColor: null },
        { name: "Mosque BG 1 Subtle", bg: ['#0C1420', '#1A293A'], accent: '#FFEB00', primaryBgImage: mosqueBg1Img, primaryBgAlpha: 0.1, primaryBgOffset: 0, primaryBgMode: 'cover', headerY: 120, festY: 170, categoryY: 240, winnersY: 380, listStartY: 520, hasPatternOverlay: false, rankCircleColor: 'rgba(255, 235, 0, 0.2)' },
        { name: "Mosque BG 2 Overlay", bg: ['#000000', '#1C0000'], accent: '#EEA236', primaryBgImage: mosqueBg2Img, primaryBgAlpha: 0.2, primaryBgOffset: 0, primaryBgMode: 'cover', headerY: 120, festY: 170, categoryY: 240, winnersY: 380, listStartY: 520, hasPatternOverlay: true, patternAlpha: 0.05, rankCircleColor: 'rgba(238, 162, 54, 0.3)' },
        { name: "Mosque BG 1 Prominent", bg: ['#000D1A', '#000000'], accent: '#FFFFFF', primaryBgImage: mosqueBg1Img, primaryBgAlpha: 0.35, primaryBgOffset: 0, primaryBgMode: 'cover', primaryBgFilter: 'grayscale(60%) brightness(80%)', headerY: 120, festY: 170, categoryY: 240, winnersY: 380, listStartY: 520, hasPatternOverlay: false, rankCircleColor: 'rgba(255, 255, 255, 0.2)' }
    ];
    const selectedTheme = themes[Math.floor(Math.random() * themes.length)];
    Promise.all([
        new Promise(resolve => { domeImg.onload = resolve; domeImg.onerror = resolve; }), 
        new Promise(resolve => { bgPatternImg.onload = resolve; bgPatternImg.onerror = resolve; }),
        new Promise(resolve => { mosqueBg1Img.onload = resolve; mosqueBg1Img.onerror = resolve; }),
        new Promise(resolve => { mosqueBg2Img.onload = resolve; mosqueBg2Img.onerror = resolve; })
    ]).then(() => {
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        selectedTheme.bg.forEach((color, index) => {
            gradient.addColorStop(index / (selectedTheme.bg.length - 1 || 1), color);
        });
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (selectedTheme.primaryBgImage && selectedTheme.primaryBgImage.complete && selectedTheme.primaryBgImage.naturalWidth > 0) {
            ctx.save(); 
            ctx.globalAlpha = selectedTheme.primaryBgAlpha;
            if (selectedTheme.primaryBgFilter) {
                ctx.filter = selectedTheme.primaryBgFilter;
            }
            if (selectedTheme.primaryBgMode === 'cover') {
                const img = selectedTheme.primaryBgImage;
                const imgAspectRatio = img.naturalWidth / img.naturalHeight;
                const canvasAspectRatio = canvas.width / canvas.height;
                let sx, sy, sWidth, sHeight;
                let dx, dy, dWidth, dHeight;
                if (imgAspectRatio > canvasAspectRatio) {
                    sHeight = img.naturalHeight;
                    sWidth = sHeight * canvasAspectRatio;
                    sx = (img.naturalWidth - sWidth) / 2;
                    sy = 0;
                } else {
                    sWidth = img.naturalWidth;
                    sHeight = sWidth / canvasAspectRatio;
                    sx = 0;
                    sy = (img.naturalHeight - sHeight) / 2;
                }
                dx = 0;
                dy = selectedTheme.primaryBgOffset || 0;
                dWidth = canvas.width;
                dHeight = canvas.height;
                ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
            } else {
                const img = selectedTheme.primaryBgImage;
                const imgWidth = 800;
                const imgHeight = imgWidth * (img.naturalHeight / img.naturalWidth);
                ctx.drawImage(img, (canvas.width - imgWidth) / 2, canvas.height - imgHeight + (selectedTheme.primaryBgOffset || 0), imgWidth, imgHeight);
            }
            ctx.restore();
            ctx.globalAlpha = 1.0;
        }
        if (selectedTheme.hasPatternOverlay && bgPatternImg.complete && bgPatternImg.naturalWidth > 0 && selectedTheme.primaryBgImage !== bgPatternImg) {
            ctx.globalAlpha = selectedTheme.patternAlpha;
            ctx.drawImage(bgPatternImg, 0, 0, canvas.width, canvas.height);
            ctx.globalAlpha = 1.0;
        }
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
        ctx.textAlign = 'center';
        ctx.fillStyle = 'white';
        ctx.font = "80px 'Ramadhan Amazing', sans-serif";
        ctx.fillText("Mehfile RabeeE", canvas.width / 2, selectedTheme.headerY);
        ctx.font = "40px 'Ramadhan Amazing', sans-serif";
        ctx.fillText("meelad fest", canvas.width / 2, selectedTheme.festY);
        ctx.font = "bold 28px 'Poppins', sans-serif";
        ctx.fillStyle = '#CCCCCC';
        ctx.fillText(`${category.name.toUpperCase()} - ${competition.name.toUpperCase()}`, canvas.width / 2, selectedTheme.categoryY);
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
        const placeOrder = { '1st': 1, '2nd': 2, '3rd': 3 };
        const sortedResults = (competition.results || [])
            .filter(r => r.name)
            .sort((a, b) => (placeOrder[a.place] || 99) - (placeOrder[b.place] || 99));
        let startY = selectedTheme.listStartY;
        const itemHeight = 150;
        sortedResults.forEach((winner) => {
            ctx.fillStyle = selectedTheme.rankCircleColor || selectedTheme.accent;
            ctx.beginPath();
            ctx.arc(220, startY - 20, 45, 0, 2 * Math.PI);
            ctx.fill();
            const rankNumber = winner.place.charAt(0);
            ctx.fillStyle = selectedTheme.bg[0];
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
        ctx.textAlign = 'center';
        ctx.fillStyle = 'white';
        ctx.font = "bold 24px 'Poppins', sans-serif";
        ctx.fillText('HAYATHUL ISLAM HIGHER SECONDARY MADRASA', canvas.width / 2, canvas.height - 80);
        ctx.font = "20px 'Poppins', sans-serif";
        ctx.fillText('Muringampurayi, Mukkam', canvas.width / 2, canvas.height - 50);
        const link = document.createElement('a');
        link.download = `Winners - ${competition.name}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
};

/**
 * NEW: Generates a poster for the overall team leaderboard.
 */
const generateOverallScorePoster = () => {
    const scores = calculateTeamScores();
    const topTeams = scores.overall.slice(0, 3); // Get top 3 teams

    if (topTeams.length === 0) {
        alert("No team scores available to generate a poster.");
        return;
    }

    const canvas = document.getElementById('poster-canvas');
    canvas.width = 1080;
    canvas.height = 1080; // Square format is good for leaderboards
    const ctx = canvas.getContext('2d');

    // Load new background images
    const bg1 = new Image();
    bg1.src = 'bg1.jpg';
    const bg2 = new Image();
    bg2.src = 'bg2.jpg';
    const bg3 = new Image();
    bg3.src = 'bg3.jpg';
    const allBackgrounds = [bg1, bg2, bg3];

    // Define themes for the team poster
    const themes = [
        {
            bgColors: ['#000000', '#2C3E50'],
            accent: '#F1C40F', // Gold
            titleColor: '#FFFFFF',
            textColor: '#ECF0F1'
        },
        {
            bgColors: ['#4A00E0', '#8E2DE2'],
            accent: '#FFFFFF', // White
            titleColor: '#FFFFFF',
            textColor: '#F2F2F2'
        },
        {
            bgColors: ['#1e3c72', '#2a5298'],
            accent: '#2980B9', // Lighter Blue
            titleColor: '#FFFFFF',
            textColor: '#EAEAEA'
        }
    ];

    const selectedTheme = themes[Math.floor(Math.random() * themes.length)];
    const selectedBgImage = allBackgrounds[Math.floor(Math.random() * allBackgrounds.length)];

    selectedBgImage.onload = () => {
        // --- Start Drawing ---

        // 1. Background Image
        ctx.save();
        ctx.globalAlpha = 0.3; // Make it subtle
        // Cover canvas with the image
        const imgAspectRatio = selectedBgImage.naturalWidth / selectedBgImage.naturalHeight;
        const canvasAspectRatio = canvas.width / canvas.height;
        let sx = 0, sy = 0, sWidth = selectedBgImage.naturalWidth, sHeight = selectedBgImage.naturalHeight;
        if (imgAspectRatio > canvasAspectRatio) {
            sWidth = sHeight * canvasAspectRatio;
            sx = (selectedBgImage.naturalWidth - sWidth) / 2;
        } else {
            sHeight = sWidth / canvasAspectRatio;
            sy = (selectedBgImage.naturalHeight - sHeight) / 2;
        }
        ctx.drawImage(selectedBgImage, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0;
        ctx.restore();

        // 2. Color Gradient Overlay
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, selectedTheme.bgColors[0] + 'B3'); // 70% opacity
        gradient.addColorStop(1, selectedTheme.bgColors[1] + 'B3'); // 70% opacity
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 3. Header Text
        ctx.textAlign = 'center';
        ctx.fillStyle = selectedTheme.titleColor;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 10;
        ctx.font = "100px 'Ramadhan Amazing', sans-serif";
        ctx.fillText("Mehfile RabeeE", canvas.width / 2, 140);
        ctx.font = "60px 'Ramadhan Amazing', sans-serif";
        ctx.fillText("meelad fest", canvas.width / 2, 210);

        // 4. Main Title
        ctx.font = "bold 110px 'Poppins', sans-serif";
        ctx.fillStyle = selectedTheme.accent;
        ctx.fillText('Team Leaderboard', canvas.width / 2, 350);
        ctx.shadowBlur = 0;
        
        // 5. Leaderboard Items
        let startY = 480;
        const itemHeight = 160;
        const places = ['1st', '2nd', '3rd'];

        topTeams.forEach((team, index) => {
            const [teamName, score] = team;

            // Background rect for each item
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fillRect(100, startY - 60, canvas.width - 200, 120);

            // Rank
            ctx.font = "bold 80px 'Poppins', sans-serif";
            ctx.fillStyle = selectedTheme.accent;
            ctx.textAlign = 'left';
            ctx.fillText(places[index], 140, startY + 25);

            // Team Name
            ctx.font = "60px 'Poppins', sans-serif";
            ctx.fillStyle = selectedTheme.textColor;
            ctx.fillText(teamName.toUpperCase(), 320, startY);

            // Score
            ctx.font = "30px 'Poppins', sans-serif";
            ctx.fillStyle = '#CCCCCC';
            ctx.fillText(`${score} Points`, 320, startY + 45);

            startY += itemHeight;
        });

        // 6. Footer
        ctx.textAlign = 'center';
        ctx.fillStyle = 'white';
        ctx.font = "bold 24px 'Poppins', sans-serif";
        ctx.fillText('HAYATHUL ISLAM HIGHER SECONDARY MADRASA', canvas.width / 2, canvas.height - 80);
        ctx.font = "20px 'Poppins', sans-serif";
        ctx.fillText('Muringampurayi, Mukkam', canvas.width / 2, canvas.height - 50);

        // --- Trigger Download ---
        const link = document.createElement('a');
        link.download = `Team-Leaderboard-Poster.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    selectedBgImage.onerror = () => {
        alert("A background image failed to load. Please try again.");
    };
};

/**
 * NEW: Downloads all entries for the currently selected category as an Excel file.
 */
const downloadCategoryEntries = () => {
    if (!currentCategory) {
        alert("Please select a category first.");
        return;
    }

    const categoryCompetitions = (data.competitions || []).filter(comp => comp.categoryId === currentCategory.id);

    if (categoryCompetitions.length === 0) {
        alert(`No competitions found for the category: ${currentCategory.name}`);
        return;
    }

    // Prepare data for Excel
    const excelData = [];
    excelData.push(['Competition', 'Place', 'Student Name', 'Class', 'Team']); // Header row

    categoryCompetitions.forEach(comp => {
        if (comp.results && comp.results.length > 0) {
            comp.results.forEach(res => {
                excelData.push([
                    comp.name || '',
                    res.place || '',
                    res.name || '',
                    res.class || '',
                    res.team || ''
                ]);
            });
        } else {
            excelData.push([comp.name, '(No results entered)', '', '', '']);
        }
    });

    // Create a new workbook and a worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(excelData);

    // Append the worksheet to the workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Entries');

    // Generate and download the Excel file
    XLSX.writeFile(wb, `${currentCategory.name}_Entries.xlsx`);
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

    // NEW event listener for the team poster button
    document.getElementById('generate-overall-poster-btn').addEventListener('click', generateOverallScorePoster);
    // NEW event listener for the download button
    document.getElementById('download-entries-btn').addEventListener('click', downloadCategoryEntries);


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
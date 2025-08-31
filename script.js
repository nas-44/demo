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
        deleteBtn.className = 'delete-item-btn';
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
        const result = (competition.results || []).find(r => r.place === place) || {};
        html += `
            <div class="student-row" data-place="${place}">
                <label>${place}:</label>
                <input type="text" class="student-name-input" placeholder="Student Name" value="${result.name || ''}">
                <input type="text" class="student-class-input" placeholder="Class" value="${result.class || ''}">
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
    const publishedCompetitions = (data.competitions || []).filter(comp => comp.isPublished);
    publishedCompetitions.forEach(comp => {
        (comp.results || []).forEach(result => {
            const points = SCORE_POINTS[result.place];
            if (points && result.team && teamScores.hasOwnProperty(result.team)) {
                teamScores[result.team] += points;
            }
        });
    });
    return Object.entries(teamScores).sort(([, a], [, b]) => b - a);
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
    if (scores.length > 0 && scores.some(s => s[1] > 0)) {
        const rows = scores.map(([team, score], i) => [i + 1, team, score]);
        overallSection.appendChild(createTable(['Rank', 'Team', 'Score'], rows));
    } else {
        overallSection.innerHTML += '<p class="no-results-msg">No published results to display.</p>';
    }
    resultsContainer.appendChild(overallSection);
};

// --- Admin Actions ---
const handlePublishToggle = (id) => {
    const comp = (data.competitions || []).find(c => c.id == id);
    if (comp) {
        comp.isPublished = !comp.isPublished;
        saveData();
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
};

const handleEditCompetition = (id) => {
    const comp = (data.competitions || []).find(c => c.id == id);
    if (comp) {
        const newName = prompt("Enter new name:", comp.name);
        if (newName && newName.trim()) {
            comp.name = newName.trim();
            saveData();
        }
    }
};

const handleDeleteCompetition = (id) => {
    if (confirm("Delete this competition?")) {
        data.competitions = (data.competitions || []).filter(comp => comp.id != id);
        saveData();
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
document.addEventListener('DOMContentLoaded', () => {
    // State variables
    let allAssets = [];
    let filteredAssets = [];
    let sortConfig = { key: 'assetName', direction: 'asc' };
    let filters = {};
    let currentPage = 1;
    const rowsPerPage = 10;
    
    // --- API endpoint URLs ---
    const GET_ASSETS_URL = 'https://assets-db-api-231063693054.europe-west4.run.app';
    const CLAIM_FP_URL = 'https://assets-db-api-false-positive-231063693054.europe-west4.run.app';
    const CLONE_TICKET_URL = 'https://assets-db-api-clone-ticket-231063693054.europe-west4.run.app';

    // DOM Elements
    const tableBody = document.getElementById('asset-list');
    const prevButton = document.getElementById('prevPage');
    const nextButton = document.getElementById('nextPage');
    const pageInfo = document.getElementById('pageInfo');
    const selectAllCheckbox = document.getElementById('selectAll');

    function initialize() {
        setupEventListeners();
        handleUrlParameters();
        fetch(GET_ASSETS_URL)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.json();
            })
            .then(data => {
                allAssets = data;
                populateFilterDropdowns();
                applyFiltersAndSort();
            })
            .catch(error => {
                console.error("Could not fetch data from API:", error);
                alert("Failed to load asset data from the server. Please check the console.");
            });
    }

    function render() {
        tableBody.innerHTML = '';
        const startIndex = (currentPage - 1) * rowsPerPage;
        const paginatedAssets = filteredAssets.slice(startIndex, startIndex + rowsPerPage);

        paginatedAssets.forEach(asset => {
            const row = document.createElement('tr');
            if (asset.falsepositive === true) {
                row.classList.add('is-false-positive');
            }
            
            row.innerHTML = `
                <td><input type="checkbox" class="select-row" data-id="${asset.assetId}"></td>
                <td>${asset.assetName}</td>
                <td>${asset.jiraTicket || ''}</td>
                <td>${asset.cmsProductName}</td>
                <td>${asset.maxCriticality}</td>
                <td>${asset.dueStatus}</td>
                <td>${asset.scannedBy}</td>
                <td>${Array.isArray(asset.environments) ? asset.environments.join(', ') : asset.environments}</td>
                <td>${asset.falsepositive}</td>
            `;
            tableBody.appendChild(row);
        });
        
        const totalPages = Math.ceil(filteredAssets.length / rowsPerPage);
        pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
        prevButton.disabled = currentPage === 1;
        nextButton.disabled = currentPage === totalPages || totalPages === 0;
        selectAllCheckbox.checked = false;
    }

    // --- UPDATED: handleTicketAction to include cloning logic ---
    function handleTicketAction(action) {
        const selectedCheckboxes = tableBody.querySelectorAll('.select-row:checked');
        const selectedIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.id);

        if (selectedIds.length === 0) {
            alert('Please select at least one asset.');
            return;
        }

        if (action === 'Claiming as False Positive') {
            if (!confirm(`Are you sure you want to mark ${selectedIds.length} asset(s) as a False Positive?`)) {
                return;
            }

            fetch(CLAIM_FP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assetIds: selectedIds }),
            })
            .then(response => {
                if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
                return response.json();
            })
            .then(data => {
                alert(`Success! ${data.updatedCount} asset(s) have been updated.`);
                allAssets.forEach(asset => {
                    if (selectedIds.includes(asset.assetId)) asset.falsepositive = true;
                });
                applyFiltersAndSort();
            })
            .catch(error => {
                console.error('Error claiming false positive:', error);
                alert('An error occurred. Please check the console.');
            });

        } else if (action === 'Cloning') {
            // --- NEW: Real logic for cloning a ticket ---
            if (!confirm(`This will create a new Jira ticket for the ${selectedIds.length} selected asset(s). Proceed?`)) {
                return;
            }

            fetch(CLONE_TICKET_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assetIds: selectedIds }),
            })
            .then(response => {
                if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
                return response.json();
            })
            .then(data => {
                alert(`Success! Jira ticket ${data.jiraKey} created and ${data.updatedCount} asset(s) have been updated.`);
                // Update the local data to reflect the new Jira ticket key
                allAssets.forEach(asset => {
                    if (selectedIds.includes(asset.assetId)) {
                        asset.jiraTicket = data.jiraKey;
                    }
                });
                // Re-render the table with the updated local data
                applyFiltersAndSort();
            })
            .catch(error => {
                console.error('Error cloning Jira ticket:', error);
                alert('An error occurred while creating the Jira ticket. Please check the console.');
            });
        }
    }
    
    // --- No changes needed below this line ---

    function setupEventListeners() {
        document.querySelectorAll('th[data-key]').forEach(header => {
            header.addEventListener('click', () => {
                const key = header.dataset.key;
                sortConfig = { key, direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc' };
                applyFiltersAndSort();
            });
        });

        document.querySelectorAll('.filter-row input, .filter-row select').forEach(input => {
            const eventType = input.tagName === 'SELECT' ? 'change' : 'keyup';
            input.addEventListener(eventType, (e) => {
                filters[e.target.dataset.key] = e.target.value;
                applyFiltersAndSort();
            });
        });

        prevButton.addEventListener('click', () => { if (currentPage > 1) { currentPage--; render(); } });
        nextButton.addEventListener('click', () => { if (currentPage < Math.ceil(filteredAssets.length / rowsPerPage)) { currentPage++; render(); } });
        
        document.getElementById('cloneJiraTicket').addEventListener('click', () => handleTicketAction('Cloning'));
        document.getElementById('claimFalsePositive').addEventListener('click', () => handleTicketAction('Claiming as False Positive'));

        selectAllCheckbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            tableBody.querySelectorAll('.select-row').forEach(checkbox => {
                checkbox.checked = isChecked;
            });
        });
        
        tableBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('select-row')) {
                console.log(`Checkbox for asset ${e.target.dataset.id} changed.`);
            }
        });
    }

    function handleUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const jiraTicketParam = urlParams.get('jiraTicket');
        if (jiraTicketParam) {
            filters['jiraTicket'] = jiraTicketParam;
            const jiraFilterInput = document.querySelector('.filter-row input[data-key="jiraTicket"]');
            if(jiraFilterInput) jiraFilterInput.value = jiraTicketParam;
        }
    }

    function populateFilterDropdowns() {
        const criticalitySet = new Set(allAssets.map(a => a.maxCriticality));
        const dueStatusSet = new Set(allAssets.map(a => a.dueStatus));
        const environmentsSet = new Set(allAssets.flatMap(a => a.environments).filter(Boolean));
        populateSelect('maxCriticality', criticalitySet);
        populateSelect('dueStatus', dueStatusSet);
        populateSelect('environments', environmentsSet);
    }
    
    function populateSelect(key, values) {
        const select = document.querySelector(`select[data-key="${key}"]`);
        if (!select) return;
        select.innerHTML = '<option value="">All</option>';
        [...values].sort().forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            select.appendChild(option);
        });
    }

    function applyFiltersAndSort() {
        filteredAssets = allAssets.filter(asset => {
            return Object.keys(filters).every(key => {
                const filterValue = filters[key].toLowerCase();
                if (!filterValue) return true;
                const assetValue = Array.isArray(asset[key]) 
                    ? asset[key].join(', ').toLowerCase() 
                    : String(asset[key] || '').toLowerCase();
                return assetValue.includes(filterValue);
            });
        });

        filteredAssets.sort((a, b) => {
            let valA = a[sortConfig.key] || '';
            let valB = b[sortConfig.key] || '';
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        currentPage = 1;
        render();
    }

    // --- Start the application ---
    initialize();
});

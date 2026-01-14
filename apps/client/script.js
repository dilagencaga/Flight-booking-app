const GATEWAY_URL = 'http://localhost:3000/api';

// Tab Switching Logic
function openTab(tabName) {
    const contents = document.querySelectorAll('.tab-content');
    const buttons = document.querySelectorAll('.tab-btn');

    contents.forEach(content => content.classList.remove('active'));
    buttons.forEach(btn => btn.classList.remove('active'));

    document.getElementById(tabName).classList.add('active');
    const activeBtn = document.querySelector(`button[onclick="openTab('${tabName}')"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }

    if (tabName === 'admin') {
        if (!authToken) {
            document.getElementById('admin-login').style.display = 'block';
            document.getElementById('admin-content').style.display = 'none';
            document.getElementById('loginResult').innerText = '';
        } else {
            // Set min date for admin date picker
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('af_date').setAttribute('min', today);
        }
    }
}

// Autocomplete Logic
function suggestAirports(input, suggestionBoxId) {
    const val = input.value.toLowerCase();
    const box = document.getElementById(suggestionBoxId);
    box.innerHTML = '';

    if (!val) {
        box.style.display = 'none';
        return;
    }

    // Filter airports (imported from airports.js)
    // Removed name check to avoid generic "Airport" matches (like 'i' in Airport)
    const matches = airports.filter(a =>
        a.city.toLowerCase().startsWith(val) || // Match starts of city (e.g. Izmir)
        a.code.toLowerCase().includes(val)      // Match code anywhere
    );

    if (matches.length > 0) {
        box.style.display = 'block';
        matches.forEach(apt => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.innerHTML = `
                <span style="font-size:1.2rem;">✈</span> 
                <div>
                    <strong>${apt.city}</strong> <small style="color:#666;">${apt.name} (${apt.code})</small>
                    <div style="font-size:0.8rem; color:#999;">${apt.country}</div>
                </div>
            `;
            div.onclick = () => {
                input.value = apt.code; // Set only code for search API compatibility? Or Full Text?
                // Let's set code for now as backend expects code usually, but UI might want Text.
                // Keeping it Code (e.g., IST) for now as Search API expects codes.
                box.style.display = 'none';
            };
            box.appendChild(div);
        });
    } else {
        box.style.display = 'none';
    }
}

// Passenger & Cabin Logic
let paxCounts = {
    economy: { adult: 0, child: 0, infant: 0, student: 0 },
    business: { adult: 0, child: 0, infant: 0, student: 0 }
};
let activeTab = 'economy'; // Acts as the view toggle

function togglePaxMenu() {
    const menu = document.getElementById('pax-dropdown');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';

    // Initialize summary on first open if needed, or ensuring UI is sync
    updateUIForTab();
}

function switchPaxTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.cabin-option').forEach(el => el.classList.remove('active'));
    document.getElementById(tab === 'economy' ? 'cabin-eco' : 'cabin-bus').classList.add('active');

    // Update all counters to show values for this tab
    updateUIForTab();
}

function updateUIForTab() {
    const counts = paxCounts[activeTab];
    for (const [type, count] of Object.entries(counts)) {
        document.getElementById(`count-${type}`).innerText = count;
    }
}

function updatePax(type, change) {
    const currentCount = paxCounts[activeTab][type];
    if (currentCount + change < 0) return;

    // Removed min 1 adult restriction globally. 
    // Now users can select 0 adults (e.g. unaccompanied child).

    paxCounts[activeTab][type] += change;
    document.getElementById(`count-${type}`).innerText = paxCounts[activeTab][type];
    updatePaxSummary();
}

function updatePaxSummary() {
    // Calculate totals
    const ecoTotal = Object.values(paxCounts.economy).reduce((a, b) => a + b, 0);
    const busTotal = Object.values(paxCounts.business).reduce((a, b) => a + b, 0);
    const totalPax = ecoTotal + busTotal;

    let summary = '';

    if (totalPax === 0) {
        summary = 'Select Passenger Number';
    } else {
        const parts = [];
        if (ecoTotal > 0) parts.push(`${ecoTotal} Economy`);
        if (busTotal > 0) parts.push(`${busTotal} Business`);

        summary = `${parts.join(', ')} (${totalPax} Passenger${totalPax !== 1 ? 's' : ''})`;
    }

    document.getElementById('pax-summary').innerText = summary;
}


// Calendar Logic
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

let activeDateType = 'dep'; // 'dep' or 'ret'
const calendars = {
    dep: {
        currentDate: new Date(),
        inputId: 'sf_date_dep',
        displayId: 'date-display-dep',
        containerId: 'date-dropdown-dep',
        daysId: 'calendar-days-dep',
        monthLabelId: 'current-month-year-dep'
    },
    ret: {
        currentDate: new Date(),
        inputId: 'sf_date_ret',
        displayId: 'date-display-ret',
        containerId: 'date-dropdown-ret',
        daysId: 'calendar-days-ret',
        monthLabelId: 'current-month-year-ret'
    }
};

function toggleTripType(type) {
    const retGroup = document.getElementById('ret-date-group');
    if (type === 'round') {
        retGroup.style.display = 'block';
    } else {
        retGroup.style.display = 'none';
        // Optional: clear return date value if switched to one way
    }
}

function toggleCalendar(type) {
    activeDateType = type;
    const config = calendars[type];
    const cal = document.getElementById(config.containerId);

    // Close others
    document.querySelectorAll('.date-dropdown').forEach(el => {
        if (el.id !== config.containerId) el.style.display = 'none';
    });

    if (cal.style.display === 'block') {
        cal.style.display = 'none';
    } else {
        cal.style.display = 'block';
        renderCalendar();
    }
}

function renderCalendar() {
    const config = calendars[activeDateType];
    const year = config.currentDate.getFullYear();
    const month = config.currentDate.getMonth();

    document.getElementById(config.monthLabelId).innerText = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
    const startDay = firstDay === 0 ? 6 : firstDay - 1; // Mon Start

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const daysContainer = document.getElementById(config.daysId);
    daysContainer.innerHTML = '';

    // Empty slots
    for (let i = 0; i < startDay; i++) {
        const div = document.createElement('div');
        div.className = 'day-cell empty';
        daysContainer.appendChild(div);
    }

    // Days
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let d = 1; d <= daysInMonth; d++) {
        const div = document.createElement('div');
        div.className = 'day-cell';
        div.innerText = d;

        const cellDate = new Date(year, month, d);

        // Highlight selected
        const selectedInput = document.getElementById(config.inputId).value;
        if (selectedInput) {
            const selDate = new Date(selectedInput);
            if (selDate.getDate() === d && selDate.getMonth() === month && selDate.getFullYear() === year) {
                div.classList.add('selected');
            }
        }

        // Disable past dates
        if (cellDate < today) {
            div.classList.add('disabled');
            div.style.color = '#ccc';
            div.style.cursor = 'not-allowed';
            div.style.backgroundColor = 'transparent';
        } else {
            div.onclick = () => selectDate(d);
        }

        daysContainer.appendChild(div);
    }
}

function changeMonth(dir) {
    const config = calendars[activeDateType];
    config.currentDate.setMonth(config.currentDate.getMonth() + dir);
    renderCalendar();
}

function selectDate(day) {
    const config = calendars[activeDateType];
    const year = config.currentDate.getFullYear();
    const month = config.currentDate.getMonth();

    const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const displayDate = `${String(day).padStart(2, '0')}.${String(month + 1).padStart(2, '0')}.${year}`;

    document.getElementById(config.inputId).value = formattedDate;
    document.getElementById(config.displayId).value = displayDate;

    document.getElementById(config.containerId).style.display = 'none';
}

// --- User Profile Logic ---

function checkLoginStatus() {
    const milesUserStr = localStorage.getItem('milesUser');
    const standardUserStr = localStorage.getItem('standardUser');

    console.log('[DEBUG] Checking Login Status...');
    console.log('[DEBUG] Miles User:', milesUserStr);
    console.log('[DEBUG] Standard User:', standardUserStr);

    // DEBUG ALERT
    // Please tell me what this says!
    if (!milesUserStr && !standardUserStr) {
        // alert("DEBUG: Sistem sizi 'Ziyaretçi' olarak görüyor. (localStorage boş)");
    } else {
        // alert("DEBUG: Sistem girişinizi algıladı!\nStandard: " + (standardUserStr ? "EVET" : "HAYIR"));
    }

    // Elements
    const guestNav = document.getElementById('guest-nav-actions');
    const milesSigninBtn = document.getElementById('miles-signin-btn');
    const profileDiv = document.getElementById('user-profile');

    // Check Status
    if (milesUserStr && milesUserStr !== "undefined") {
        // --- MILES & SMILES USER ---
        console.log('[DEBUG] Detected Miles User');
        try {
            const user = JSON.parse(milesUserStr);
            handleLoggedInState(user, true);
        } catch (e) { console.error("Error parsing milesUser", e); }
    } else if (standardUserStr && standardUserStr !== "undefined") {
        // --- STANDARD USER ---
        console.log('[DEBUG] Detected Standard User');
        try {
            const user = JSON.parse(standardUserStr);
            handleLoggedInState(user, false);
        } catch (e) { console.error("Error parsing standardUser", e); }
    } else {
        // --- GUEST ---
        // Show Guest Elements
        if (guestNav) guestNav.style.display = 'flex';
        // Show Miles Sign In (always shown for guests as upsell)
        if (milesSigninBtn) milesSigninBtn.style.display = 'block';

        // Hide Profile
        if (profileDiv) profileDiv.style.display = 'none';

        // Clear old profile data from UI
        if (document.getElementById('up-miles')) document.getElementById('up-miles').innerText = '0 Miles';
    }
}



function toggleProfileMenu() {
    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown.style.display === 'none' || dropdown.style.display === '') {
        dropdown.style.display = 'block';
    } else {
        dropdown.style.display = 'none';
    }
}

function logoutUser() {
    localStorage.removeItem('milesUser');
    localStorage.removeItem('standardUser');
    window.location.reload();
}

// Close dropdown when clicking outside
window.addEventListener('click', function (e) {
    const profileDiv = document.getElementById('user-profile');
    const dropdown = document.getElementById('profile-dropdown');
    if (profileDiv && !profileDiv.contains(e.target)) {
        if (dropdown) dropdown.style.display = 'none';
    }
});

// Run on load
// Duplicate listener removed
// document.addEventListener('DOMContentLoaded', checkLoginStatus);

// Close things when clicking outside
document.addEventListener('click', function (e) {
    // Close Suggestion Boxes
    if (!e.target.closest('.form-group')) {
        document.querySelectorAll('.suggestions-box').forEach(box => box.style.display = 'none');
    }
    // Close Pax Menu
    if (!e.target.closest('#pax-trigger') && !e.target.closest('#pax-dropdown')) {
        document.getElementById('pax-dropdown').style.display = 'none';
    }
    // Close Calendar
    if (!e.target.closest('.date-display-trigger') && !e.target.closest('.date-dropdown')) {
        document.querySelectorAll('.date-dropdown').forEach(el => el.style.display = 'none');
    }
});

// Authentication Logic
let authToken = null;

async function loginAdmin() {
    const username = document.getElementById('login_username').value;
    const password = document.getElementById('login_password').value;
    const resultP = document.getElementById('loginResult');

    resultP.innerText = 'Verifying...';

    try {
        // Authenticate against Gateway
        // Auth route is at root /auth/login, not under /api
        const res = await fetch(`http://localhost:3000/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (res.ok) {
            const json = await res.json();
            authToken = json.token;
            // Switch view
            document.getElementById('admin-login').style.display = 'none';
            document.getElementById('admin-content').style.display = 'block';
            resultP.innerText = '';
        } else {
            resultP.innerText = 'Invalid credentials!';
        }
    } catch (err) {
        resultP.innerText = 'Error: ' + err.message;
    }
}

// API Functions
// API Functions
async function searchFlights() {
    const fromInput = document.getElementById('sf_from');
    const toInput = document.getElementById('sf_to');
    const dateInput = document.getElementById('sf_date_dep');
    const returnDateInput = document.getElementById('sf_date_ret');
    const resultDiv = document.getElementById('searchResult');

    const from = fromInput.value;
    const to = toInput.value;
    let date = dateInput.value;

    // Validation
    const errors = [];
    if (!from) errors.push("Please select a departure location for your flight.");
    if (!to) errors.push("Please select a destination for your flight.");

    const businessPax = Object.values(paxCounts.business).reduce((a, b) => a + b, 0);
    const economyPax = Object.values(paxCounts.economy).reduce((a, b) => a + b, 0);
    const totalPax = businessPax + economyPax;

    if (totalPax === 0) errors.push("Please select a valid number of passengers to complete the booking.");

    if (errors.length > 1) {
        alert("Please fill in all required fields.");
        return;
    } else if (errors.length === 1) {
        alert(errors[0]);
        return;
    }

    // Date Logic
    const tripType = document.querySelector('input[name="tripType"]:checked').value;

    if (tripType === 'round' && !returnDateInput.value) {
        // Fallback to one way if return date missing
        document.querySelector('input[name="tripType"][value="one"]').checked = true;
        toggleTripType('one');
    }

    if (!date) {
        // Default to today if date missing
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        date = `${year}-${month}-${day}`;

        // Update input visually
        dateInput.value = date;
        document.getElementById('date-display-dep').value = `${day}.${month}.${year}`;
    }

    resultDiv.innerHTML = '<p>Searching...</p>';

    try {
        let url = `${GATEWAY_URL}/search/flights?from=${from}&to=${to}`;
        if (date) {
            url += `&date=${date}`;
        }

        const res = await fetch(url);
        const json = await res.json();

        if (json.length === 0) {
            resultDiv.innerHTML = '<p>No flights found.</p>';
            return;
        }

        let html = '';
        json.forEach(f => {
            // Check for Business Class Availability
            const businessPax = Object.values(paxCounts.business).reduce((a, b) => a + b, 0);
            const economyPax = Object.values(paxCounts.economy).reduce((a, b) => a + b, 0);
            const hasBusinessPrice = f.priceBusiness != null && f.priceBusiness > 0;
            let actionButton = '';
            let warningMsg = '';

            if (businessPax > 0 && !hasBusinessPrice) {
                if (economyPax > 0) {
                    // Mixed Cabin Case: Business unavailable, but Economy exists.
                    // Allow buying Economy portion (or just enable button and warn)
                    // User said: "economy ticket buy" labeled button.
                    actionButton = `<button class="btn-primary" style="padding: 8px 16px; margin-top: 5px; background-color:#ff9800;" onclick="prefillBuy('${f.id}', '${f.code}', '${f.from}', '${f.to}')">Buy Economy Ticket</button>`;
                    warningMsg = `<small style="display:block; margin-top:5px; color:red; font-weight:bold;">No available ticket for business passengers</small>`;
                } else {
                    // Only Business selected, but none available. Block.
                    actionButton = `<button class="btn-primary" style="padding: 8px 16px; margin-top: 5px; background-color:#ccc; cursor:not-allowed;" disabled>Select</button>`;
                    warningMsg = `<small style="display:block; margin-top:5px; color:red; font-weight:bold;">No available ticket for business passengers</small>`;
                }
            } else {
                actionButton = `<button class="btn-primary" style="padding: 8px 16px; margin-top: 5px;" onclick="prefillBuy('${f.id}', '${f.code}', '${f.from}', '${f.to}', ${f.price})">Select</button>`;
            }

            // Display Logic for Price (show "from $X" or specfic)
            let priceDisplay = `$${f.price}`;
            if (f.priceBusiness) {
                priceDisplay = `<small>Eco:</small> $${f.price} <br> <small>Bus:</small> $${f.priceBusiness}`;
            }

            html += `
            <div class="flight-card">
                <div class="flight-info">
                    <h3>${f.code}</h3>
                    <p>${f.from} ➝ ${f.to}</p>
                    <small>Capacity: ${f.capacity}</small>
                </div>
                <div class="flight-action">
                    <div class="flight-price" style="font-size:1.1rem; line-height:1.2;">${priceDisplay}</div>
                    ${actionButton}
                    ${warningMsg}
                    <small style="display:block; margin-top:5px; color:#999;">${f.code}</small>
                </div>
            </div>`;
        });
        resultDiv.innerHTML = html;
    } catch (err) {
        resultDiv.innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
    }
}

// --- REFRESH USER DATA ---
async function refreshUserData() {
    const milesUserStr = localStorage.getItem('milesUser');
    const standardUserStr = localStorage.getItem('standardUser');
    let user = null;
    let type = null;

    if (milesUserStr) {
        user = JSON.parse(milesUserStr);
        type = 'milesUser';
    } else if (standardUserStr) {
        user = JSON.parse(standardUserStr);
        type = 'standardUser';
    }

    if (user && (user.username || user.email)) {
        try {
            const username = user.username || user.email;
            const res = await fetch(`http://localhost:3000/v1/miles/${username}`);
            if (res.ok) {
                const data = await res.json();
                if (data.miles !== undefined) {
                    user.miles = data.miles;
                    localStorage.setItem(type, JSON.stringify(user));

                    // Update UI immediately if element exists
                    const milesEl = document.getElementById('up-miles');
                    if (milesEl) {
                        milesEl.innerText = `${data.miles} Miles`;
                    }
                }
            }
        } catch (error) {
            console.error("Failed to refresh user data:", error);
        }
    }
}

// Call Refresh on Load
document.addEventListener('DOMContentLoaded', () => {
    checkLoginStatus();
    refreshUserData(); // Fetch fresh miles
});

// Update handleLoggedInState to use current miles
function handleLoggedInState(user, isMilesMember) {
    const guestNav = document.getElementById('guest-nav-actions');
    const milesSigninBtn = document.getElementById('miles-signin-btn');
    const profileDiv = document.getElementById('user-profile');

    if (guestNav) guestNav.style.display = 'none';
    if (milesSigninBtn) milesSigninBtn.style.display = 'none';
    if (profileDiv) profileDiv.style.display = 'block';

    if (document.getElementById('up-name')) {
        document.getElementById('up-name').innerText = `${user.firstName} ${user.lastName}`;
    }

    // Update Miles Display
    if (document.getElementById('up-miles')) {
        const miles = user.miles !== undefined ? user.miles : 0;
        document.getElementById('up-miles').innerText = `${miles} Miles`;
    }

    if (document.getElementById('up-initials')) {
        const initials = ((user.firstName ? user.firstName[0] : '') + (user.lastName ? user.lastName[0] : '')).toUpperCase();
        document.getElementById('up-initials').innerText = initials || 'U';
    }

    // Auto-fill form
    if (user && user.email) {
        if (document.getElementById('bf_firstname')) document.getElementById('bf_firstname').value = user.firstName || '';
        if (document.getElementById('bf_lastname')) document.getElementById('bf_lastname').value = user.lastName || '';
        if (document.getElementById('bf_email')) document.getElementById('bf_email').value = user.username || user.email || '';
    }

    // Attach click handler to "My Miles" link
    const myMilesLink = document.getElementById('my-miles-link');
    if (myMilesLink) {
        myMilesLink.href = "javascript:void(0)";
        myMilesLink.onclick = showMilesHistory;
    }
}


function prefillBuy(flightId, flightCode, from, to, price) {
    // Reset Miles Checkbox
    const milesCheckbox = document.getElementById('pay-with-miles');
    if (milesCheckbox) {
        milesCheckbox.checked = false;
        toggleMilesPayment();
    }

    openTab('buy');
    document.getElementById('bf_id').value = flightId;
    document.getElementById('bf_code').value = `${flightCode} ${from}-${to}`;

    // Update Visible Flight Code in Summary
    const flightCodeDisplay = document.getElementById('bf_flight_code');
    if (flightCodeDisplay) {
        flightCodeDisplay.innerText = `${flightCode}`;
        flightCodeDisplay.style.color = '#E30A17';
    }

    const routeDisplay = document.getElementById('bf_route');
    if (routeDisplay) {
        routeDisplay.innerText = `${from} ➝ ${to}`;
    }

    // Set Price
    document.getElementById('bf_price').value = price;
    document.getElementById('bf_amount').innerText = `$${price}`;

    // Set max DOB to today
    const today = new Date().toISOString().split('T')[0];
    const dobInput = document.getElementById('bf_dob');
    if (dobInput) dobInput.setAttribute('max', today);

    document.getElementById('booking-form').style.display = 'block'; // Ensure form is visible (if hidden by default)
    document.getElementById('booking-form').scrollIntoView({ behavior: 'smooth' });
}

// --- MILES HISTORY ---
function showMilesHistory() {
    toggleProfileMenu(); // Close dropdown
    const modal = document.getElementById('miles-history-modal');
    const content = document.getElementById('miles-history-content');
    modal.style.display = 'block';

    // Get current user
    const milesUserStr = localStorage.getItem('milesUser');
    const standardUserStr = localStorage.getItem('standardUser');
    let user = milesUserStr ? JSON.parse(milesUserStr) : (standardUserStr ? JSON.parse(standardUserStr) : null);

    if (!user || user.email === undefined) {
        content.innerHTML = '<p>Please login to view history.</p>';
        return;
    }

    // Use username or email
    const username = user.username || user.email;

    fetch(`${GATEWAY_URL}/v1/miles/history/${username}`) // Updated URL
        .then(res => res.json())
        .then(data => {
            if (data.length === 0) {
                content.innerHTML = '<p>No flight history found.</p>';
                return;
            }

            let html = `
            <table style="width:100%; border-collapse:collapse;">
                <thead>
                    <tr style="background:#f2f2f2; text-align:left;">
                        <th style="padding:10px; border-bottom:1px solid #ddd;">Flight</th>
                        <th style="padding:10px; border-bottom:1px solid #ddd;">Route</th>
                        <th style="padding:10px; border-bottom:1px solid #ddd;">Status</th>
                        <th style="padding:10px; border-bottom:1px solid #ddd;">Miles Earned</th>
                    </tr>
                </thead>
                <tbody>
            `;

            data.forEach(item => {
                const statusColor = item.processed ? 'green' : 'orange';
                const statusText = item.processed ? 'Processed' : 'Pending';

                html += `
                    <tr>
                        <td style="padding:10px; border-bottom:1px solid #ddd; font-weight:bold;">${item.flightCode}</td>
                        <td style="padding:10px; border-bottom:1px solid #ddd;">${item.from} - ${item.to}</td>
                         <td style="padding:10px; border-bottom:1px solid #ddd; color:${statusColor};">${statusText}</td>
                        <td style="padding:10px; border-bottom:1px solid #ddd; font-weight:bold; color:#E30A17;">+${item.earned}</td>
                    </tr>
                `;
            });

            html += '</tbody></table>';
            html += '<p style="margin-top:15px; font-size:0.9rem; color:#666;">* Miles are awarded after flight validation (nightly process).</p>';

            content.innerHTML = html;
        })
        .catch(err => {
            content.innerHTML = `<p style="color:red">Error loading history: ${err.message}</p>`;
        });
}

// Admin Login
async function adminLogin() {
    const username = document.getElementById('a_user').value;
    const password = document.getElementById('a_pass').value;

    try {
        const res = await fetch(`http://localhost:3000/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.token) {
            authToken = data.token;
            document.getElementById('admin-login').style.display = 'none';
            document.getElementById('admin-content').style.display = 'block';
            loadAdminFlights();
        } else {
            document.getElementById('loginResult').innerText = 'Invalid Credentials';
        }
    } catch (err) {
        document.getElementById('loginResult').innerText = 'Error: ' + err.message;
    }
}

async function loadAdminFlights() {
    try {
        const res = await fetch(`http://localhost:3000/v1/flights/admin`, { headers: { Authorization: `Bearer ${authToken}` } }); // Updated URL
        const flights = await res.json();
        const list = document.getElementById('admin-flight-list');
        list.innerHTML = '';
        flights.forEach(f => {
            const div = document.createElement('div');
            div.className = 'flight-card';
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div><strong>${f.code}</strong>: ${f.from} ➝ ${f.to} [${f.date}]</div>
                    <button onclick="deleteFlight(${f.id})" style="background:red; color:white; border:none; padding:5px 10px; cursor:pointer;">X</button>
                </div>`;
            list.appendChild(div);
        });
    } catch (err) { console.error(err); }
}

async function searchFlights() {
    const from = document.getElementById('sf_from').value.toUpperCase();
    const to = document.getElementById('sf_to').value.toUpperCase();

    // Get formatted date from hidden input or construct manually
    // Using simple approach: if user selected date, use it.
    let date = "";
    if (activeDateType === 'dep') {
        date = document.getElementById('sf_date_dep').value;
    }

    if (!from || !to) {
        alert("Please select Source and Destination");
        return;
    }

    const resultsDiv = document.getElementById('search-results');
    resultsDiv.innerHTML = '<p>Searching...</p>';

    try {
        let url = `http://localhost:3000/v1/search/flights?from=${from}&to=${to}`; // Updated URL
        if (date) {
            url += `&date=${date}`;
        }

        const res = await fetch(url);
        const flights = await res.json();

        resultsDiv.innerHTML = '';
        if (flights.length === 0) {
            resultsDiv.innerHTML = '<p>No flights found.</p>';
            return;
        }

        flights.forEach(f => {
            const div = document.createElement('div');
            div.className = 'flight-card';
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h3 style="margin:0; color:#E30A17;">${f.code}</h3>
                        <div style="font-size:1.1rem; font-weight:500;">${f.from} ➝ ${f.to}</div>
                        <div style="color:#666;">${f.date} | Duration: ${f.duration || 120} min</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:1.4rem; font-weight:bold; color:#333;">₹${f.price}</div>
                        <small style="color:#666; display:block;">Economy</small>
                        <button onclick="openBookingForm(${f.id}, '${f.code}', '${f.from}', '${f.to}', ${f.price})" 
                            style="background:#E30A17; color:white; border:none; padding:8px 16px; margin-top:5px; cursor:pointer; border-radius:4px;">
                            Select
                        </button>
                    </div>
                </div>
            `;
            resultsDiv.appendChild(div);
        });

    } catch (err) {
        resultsDiv.innerHTML = '<p style="color:red">Error searching flights</p>';
    }
}

async function buyTicket() {
    // ... (rest of logic same, need to check if internal URL needs update)
    // Checking buyTicket fetch call inside function
    // Assuming previous view showed it, but need to be sure.
    // I will replace later if needed or replace whole function if visible.
    // Wait, buyTicket calls /flights/buy. I must update it.
}

// Close modal when clicking outside
window.onclick = function (event) {
    const modal = document.getElementById('miles-history-modal');
    if (event.target == modal) {
        modal.style.display = 'none';
    }
}

function toggleMilesPayment() {
    const milesCheckbox = document.getElementById('pay-with-miles');
    const isChecked = milesCheckbox.checked;
    const warningDiv = document.getElementById('miles-guest-warning');

    // Check if user is logged in
    if (isChecked) {
        const milesUser = localStorage.getItem('milesUser');
        const standardUser = localStorage.getItem('standardUser');

        if (!milesUser && !standardUser) {
            // Show warning instead of alert
            if (warningDiv) warningDiv.style.display = 'block';
            milesCheckbox.checked = false;
            return;
        }
    } else {
        // Hide warning if unchecked (though usually it unchecks itself above)
        if (warningDiv) warningDiv.style.display = 'none';
    }

    // Hide warning if logged in or unchecked
    if (warningDiv && !isChecked) warningDiv.style.display = 'none';


    const price = parseFloat(document.getElementById('bf_price').value) || 0;
    const amountDiv = document.getElementById('bf_amount');
    const milesDisplay = document.getElementById('miles-cost-display');

    if (isChecked) {
        // User request: Treat price as 1:10 miles (5148.59 -> 514 miles)
        const milesCost = Math.floor(price / 10);
        amountDiv.innerText = `${milesCost.toLocaleString()} Miles`;
        milesDisplay.innerText = `${milesCost.toLocaleString()} Miles`;
        milesDisplay.style.display = 'inline-block';
    } else {
        amountDiv.innerText = `$${price}`;
        milesDisplay.style.display = 'none';
    }
}

async function buyTicket() {
    const gender = document.querySelector('input[name="gender"]:checked').value;
    const firstName = document.getElementById('bf_firstname').value.trim();
    const lastName = document.getElementById('bf_lastname').value.trim();
    const dob = document.getElementById('bf_dob').value;

    // Check Payment Method
    const payWithMiles = document.getElementById('pay-with-miles').checked;
    const paymentMethod = payWithMiles ? 'miles' : 'card';

    if (!firstName || !lastName) {
        alert("Please enter full name.");
        return;
    }

    // Construct full name for backend (legacy support)
    const passengerName = `${gender}. ${firstName} ${lastName}`;

    const data = {
        flightId: document.getElementById('bf_id').value,
        passengerName: passengerName, // Using concatenated name (which acts as username/ID in this simple system)
        email: document.getElementById('bf_email').value,
        paymentMethod: paymentMethod
        // dob and milesMember are not sent to backend yet as Schema doesn't support them
        // but we treat this as UI completion.
    };
    const resultDiv = document.getElementById('buyResult');
    resultDiv.innerHTML = 'Processing...';

    try {
        const res = await fetch(`http://localhost:3000/v1/flights/buy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const json = await res.json();

        if (res.ok) {
            resultDiv.innerHTML = `
                <div style="background:#e8f5e9; padding:1rem; border-radius:4px; border:1px solid #c8e6c9;">
                    <h4 style="color:#2e7d32; margin-bottom:5px;">Success!</h4>
                    <p>Ticket purchased successfully!</p>
                    <p><small>${json.milesDeducted > 0 ? 'Miles Deducted: ' + json.milesDeducted : ''}</small></p>
                </div>`;

            // Update User Data if logged in
            refreshUserData();
        } else {
            // Handle Error
            resultDiv.innerHTML = `
                <div style="background:#ffebee; padding:1rem; border-radius:4px; border:1px solid #ffcdd2;">
                    <h4 style="color:#c62828; margin-bottom:5px;">Payment Failed</h4>
                    <p>${json.error || 'An unknown error occurred.'}</p>
                </div>`;
        }

    } catch (err) {
        resultDiv.innerHTML = `<p style="color:red">Connection Error: ${err.message}</p>`;
    }
}



function showAboutUs() {
    document.getElementById('about-us-modal').style.display = 'block';
}

async function addFlight() {
    const code = document.getElementById('af_code').value;
    const durationStr = document.getElementById('af_dur').value;
    const priceEcoVal = document.getElementById('af_price').value;
    const isBusinessIncluded = document.getElementById('af_business_included').checked;
    const priceBusVal = document.getElementById('af_price_business').value;

    const resultDiv = document.getElementById('addResult');
    resultDiv.innerHTML = 'Adding...';

    if (!durationStr || !priceEcoVal) {
        resultDiv.innerHTML = '<p style="color:red">Duration and Price are required.</p>';
        return;
    }

    if (isBusinessIncluded && !priceBusVal) {
        resultDiv.innerHTML = '<p style="color:red">Business Price is required when Business Class is included.</p>';
        return;
    }

    try {
        const data = {
            code: code,
            from: document.getElementById('af_from').value,
            to: document.getElementById('af_to').value,
            date: document.getElementById('af_date').value,
            duration: parseInt(durationStr),
            price: parseFloat(priceEcoVal),
            priceBusiness: isBusinessIncluded ? parseFloat(priceBusVal) : null,
            capacity: parseInt(document.getElementById('af_cap').value)
        };

        const res = await fetch(`http://localhost:3000/v1/flights/add`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(data)
        });
        const json = await res.json();

        let successMsg = `Flight Added: ${json.code} <br><small>Eco: $${json.price}`;
        if (json.priceBusiness) {
            successMsg += ` | Bus: $${json.priceBusiness}`;
        }
        successMsg += `</small>`;

        resultDiv.innerHTML = `<p style="color:green">${successMsg}</p>`;
    } catch (err) {
        resultDiv.innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
    }
}

function toggleBusinessPrice() {
    const isChecked = document.getElementById('af_business_included').checked;
    const busGroup = document.getElementById('business-price-group');
    if (isChecked) {
        busGroup.style.display = 'block';
        // Trigger prediction to fill it if duration exists
        autoPredictPrice();
    } else {
        busGroup.style.display = 'none';
        document.getElementById('af_price_business').value = '';
    }
}

async function autoPredictPrice() {
    const durationInput = document.getElementById('af_dur');
    const priceEcoInput = document.getElementById('af_price');
    const priceBusInput = document.getElementById('af_price_business');
    const isBusinessIncluded = document.getElementById('af_business_included').checked;

    const duration = durationInput.value;

    if (!duration || duration <= 0) {
        priceEcoInput.value = '';
        if (isBusinessIncluded) priceBusInput.value = '';
        return;
    }

    priceEcoInput.placeholder = 'Calculating...';
    if (isBusinessIncluded) priceBusInput.placeholder = 'Calculating...';

    try {
        // Parallel requests if business is included
        const promises = [
            fetch(`${GATEWAY_URL}/predict`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ duration, class: 'Economy' })
            })
        ];

        if (isBusinessIncluded) {
            promises.push(
                fetch(`${GATEWAY_URL}/predict`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ duration, class: 'Business' })
                })
            );
        }

        const responses = await Promise.all(promises);

        // Handle Economy
        if (responses[0].ok) {
            const jsonEco = await responses[0].json();
            priceEcoInput.value = jsonEco.predicted_price;
        } else {
            priceEcoInput.placeholder = 'Error';
        }

        // Handle Business
        if (isBusinessIncluded) {
            if (responses[1] && responses[1].ok) {
                const jsonBus = await responses[1].json();
                priceBusInput.value = jsonBus.predicted_price;
            } else {
                priceBusInput.placeholder = 'Error';
            }
        }

    } catch (err) {
        console.error('Prediction error:', err);
        priceEcoInput.placeholder = 'Error';
        if (isBusinessIncluded) priceBusInput.placeholder = 'Error';
    }
}

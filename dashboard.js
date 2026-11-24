// --- GLOBAL CHART SETTINGS ---
Chart.defaults.font.size = 14; 
Chart.defaults.plugins.legend.labels.font = { size: 16, weight: 'bold' };

let myChart, sysChart, voltChart, emiSysChart, compareChart;
let globalChartData = null; 
let flatDataMap = {};

/////////////
// Emails
////////////

function sendTestEmail() {

    if (!confirm("Are you sure you want to dispatch a diagnostic email to the mailing list?")) {
        return; // Stop if they click Cancel
    }
    const btn = document.getElementById('email-btn');
    const originalText = btn.innerText;
    
    btn.innerText = "⏳ Sending Email...";
    btn.disabled = true;

    fetch('/api/email/test', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                alert("✅ Success: " + data.message);
            } else {
                alert("🚨 Error: " + data.message);
            }
        })
        .catch(err => {
            alert("Network Error: Could not reach the Pi.");
            console.error(err);
        })
        .finally(() => {
            btn.innerText = originalText;
            btn.disabled = false;
        });
}




//////////////
// USB database backup
//////

// 1. Live Status Tracker
function updateUSBStatus() {
    fetch('/api/usb/status')
        .then(res => res.json())
        .then(data => {
            const el = document.getElementById('usb-status-indicator');
            if (data.mounted) {
                el.innerText = "● USB: MOUNTED";
                el.style.color = "#2ecc71"; // Green
                el.style.background = "rgba(46, 204, 113, 0.1)";
            } else {
                el.innerText = "○ USB: DISCONNECTED";
                el.style.color = "#e74c3c"; // Red
                el.style.background = "rgba(231, 76, 60, 0.1)";
            }
        });
}

// Start the tracker (runs every 5 seconds)
setInterval(updateUSBStatus, 5000);
updateUSBStatus(); // Run once immediately on load

// 2. Integrity Check Function
function verifyBackups() {
    const btn = document.getElementById('verify-btn');
    btn.innerText = "⏳ Verifying...";
    
    fetch('/api/usb/verify', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                alert("🔒 Secure: " + data.message);
            } else {
                alert("🚨 Warning: " + data.message);
            }
        })
        .finally(() => {
            btn.innerText = "🔍 Verify Integrity";
        });
}



// Function to trigger a manual backup script


function triggerBackup() {

    if (!confirm("Are you sure you want to run a manual database backup? This will hit the disk and take a moment.")) {
        return; // Stop if they click Cancel
    }

    const btn = document.getElementById('backup-btn');
    btn.innerText = "⏳ Backing up...";
    btn.disabled = true;

    // 1. Tell the Pi to start the backup script
    fetch('/api/usb/backup', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                // 2. Refresh the UI elements
                loadBackups(); 
                fetchLogs();
                
                // 3. Immediately chain the Verify function!
                // This calls your working Python endpoint and handles the alert pop-up
                verifyBackups();
                
                // Optional: Update the "Last Verified" timestamp if you are using it
                if (typeof updateLastVerified === "function") {
                    updateLastVerified(); 
                }
            } else {
                alert("🚨 Backup Error: " + data.message);
            }
        })
        .catch(err => {
            alert("Network Error: Could not reach the Pi.");
            console.error(err);
        })
        .finally(() => {
            // Put the button back to normal
            btn.innerText = "💾 Run Backup";
            btn.disabled = false;
        });
}


///////////
// USB eject and mount
/////////////////////

// Function to mount a newly inserted USB drive
function mountUSB() {

    if (!confirm("Are you sure you want to mount the USB drive? Ensure it is physically plugged in.")) {
        return; // Stop if they click Cancel
    }

    const btn = document.getElementById('mount-btn');
    const originalText = btn.innerText;
    
    btn.innerText = "⏳ Mounting...";
    btn.disabled = true;

    fetch('/api/usb/mount', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                alert("✅ " + data.message);
                
                // Reset the Eject button back to its red, clickable state
                const ejectBtn = document.getElementById('eject-btn');
                if (ejectBtn) {
                    ejectBtn.innerText = "⏏️ Eject USB";
                    ejectBtn.style.backgroundColor = "#e74c3c";
                    ejectBtn.disabled = false;
                    ejectBtn.style.opacity = "1";
                }
                
                // Tell the dashboard to scan the drive and show the files!
                document.getElementById('backup-list').innerHTML = '<p>Scanning USB drive...</p>';
                loadBackups(); 
            } else {
                alert("⚠️ Error: " + data.message);
            }
        })
        .catch(err => {
            console.error("Failed to mount:", err);
            alert("Network Error: Could not reach the Pi.");
        })
        .finally(() => {
            // Always put the mount button back to normal
            btn.innerText = originalText;
            btn.disabled = false;
        });
}



// Function to safely eject the USB drive
function ejectUSB() {
// NEW: Pop up an "Are you sure?" confirmation box
    if (!confirm("Are you sure you want to eject the USB drive? Make sure no backups are currently running!")) {
        return; // Stop here if they click "Cancel"
    }

    const btn = document.getElementById('eject-btn');
    const originalText = btn.innerText;
    
    // Change button state to show it's working
    btn.innerText = "⏳ Ejecting...";
    btn.disabled = true;
    btn.style.opacity = "0.7";

    fetch('/api/usb/eject', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                alert("✅ Success: " + data.message);
                btn.innerText = "✅ Safe to Remove";
                btn.style.backgroundColor = "#27ae60"; // Turn green
                
                // Clear the backup list since the drive is gone
                document.getElementById('backup-list').innerHTML = 
                    '<div style="text-align: center; color: #f1c40f; padding: 20px;">USB Drive Unmounted. Please physically unplug the drive.</div>';
            } else {
                alert("⚠️ Error: " + data.message + "\n\n(Wait a moment and try again if a backup is currently running.)");
                btn.innerText = originalText;
                btn.disabled = false;
                btn.style.opacity = "1";
            }
        })
        .catch(err => {
            console.error("Failed to eject:", err);
            alert("Network Error: Could not reach the Pi.");
            btn.innerText = originalText;
            btn.disabled = false;
            btn.style.opacity = "1";
        });
}



//////////////
// Manual Logs and tags
////////


// Global variable to hold the full log text
let rawManualLogs = "";


// Keep track of selected tags
let selectedTags = new Set();



// 1. Fetch Logs and store them
function fetchManualLogs() {
    fetch('/api/manual_logs') // Or '/manual_logs' depending on your routing
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                rawManualLogs = data.logs || "No entries yet. Be the first to log something!";
                filterLogs(); // Call the filter to display the text
            }
        });
}

// 2. Filter the text based on the dropdown
function filterLogs() {
    const filterVal = document.getElementById('log-filter').value;
    const display = document.getElementById('manual-log-display');

    // If there's no data, just show the placeholder
    if (!rawManualLogs || rawManualLogs.startsWith("No entries")) {
        display.textContent = rawManualLogs;
        return;
    }

    // If "All" is selected, show everything
    if (filterVal === "all") {
        display.textContent = rawManualLogs;
    } else {
        // Split the text into lines, and only keep lines that contain the exact tag format: [Tag]
        const lines = rawManualLogs.split('\n');
        const tagToFind = `[${filterVal}]`;
        const filteredLines = lines.filter(line => line.includes(tagToFind));
        
        display.textContent = filteredLines.length > 0 
            ? filteredLines.join('\n') 
            : `No logs found containing the tag: [${filterVal}]`;
    }
    
    // Scroll to bottom so latest is visible
    display.scrollTop = display.scrollHeight;
}

// 3. Update fetchTags to populate both the pills AND the dropdown
function fetchTags() {
    fetch('/api/tags') // Or '/tags'
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                // Handle the Tag Pills
                const container = document.getElementById('tag-container');
                container.innerHTML = '<span style="color: #bdc3c7; font-size: 14px; margin-right: 5px; line-height: 28px;">Tags:</span>';
                
                // Handle the Dropdown Options
                const filterDropdown = document.getElementById('log-filter');
                const currentSelection = filterDropdown.value; // Remember what user has selected
                filterDropdown.innerHTML = '<option value="all">Show All Logs</option>';

                data.tags.forEach(tag => {
                    // Build Pill Button
                    const btn = document.createElement('button');
                    btn.innerText = tag;
                    btn.className = 'tag-btn';
                    btn.onclick = () => toggleTag(btn, tag);
                    container.appendChild(btn);

                    // Build Dropdown Option
                    const opt = document.createElement('option');
                    opt.value = tag;
                    opt.innerText = tag;
                    filterDropdown.appendChild(opt);
                });

                // Restore previous selection if it still exists
                if (data.tags.includes(currentSelection)) {
                    filterDropdown.value = currentSelection;
                }
            }
        })
        .catch(err => console.error("Failed to load tags:", err));
}




// Function to create and save a new tag
function addNewTag() {
    const input = document.getElementById('new-tag-input');
    const newTag = input.value.trim();

    if (!newTag) return;

    fetch('/api/tags', { // Or '/tags' depending on how your Nginx is routed
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: newTag })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            input.value = ''; // Clear the input box
            fetchTags();      // Re-fetch the buttons so the new one appears instantly
        } else {
            alert("Error adding tag: " + data.message);
        }
    })
    .catch(err => console.error("Failed to create tag:", err));
}



// Toggle tag selection state
function toggleTag(btn, tag) {
    if (selectedTags.has(tag)) {
        selectedTags.delete(tag);
        btn.classList.remove('active');
    } else {
        selectedTags.add(tag);
        btn.classList.add('active');
    }
}


// Function to send a new entry
function submitManualLog() {
    const input = document.getElementById('manual-input');
    const entryText = input.value.trim();

    if (!entryText) return;

    fetch('/api/manual_logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
// NEW: Convert the Set of tags to an Array and send it
        body: JSON.stringify({ entry: entryText, tags: Array.from(selectedTags) })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            input.value = ''; // Clear the box

            // Clear tags for the next entry
            selectedTags.clear();
            document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));

            fetchManualLogs(); // Refresh the display
        } else {
            alert("Error: " + data.message);
        }
    });
}

function downloadManualLog() {
    // This tells the browser to go to the download URL
    window.location.href = '/manual_logs/download';
}

function switchTab(tabId, btnElement) {
  // 1. Switch the active tab content and button styles
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    // Safety check: ensure btnElement exists before touching classList
    if (btnElement) {
        btnElement.classList.add('active');
    }

// 2. Hide or Show the Global Controls Bar
    const globalControls = document.querySelector('.global-controls');
    if (globalControls) {
        // Hide if navigating to Backups, Logs, or Manual Log
        if (['tab-backups', 'tab-logs', 'tab-manual'].includes(tabId)) {
            globalControls.style.display = 'none';
        } else {
            // Show for Overview, EMI, Pi Internal, and Analysis
            globalControls.style.display = 'block';
        }
    }


    // Trigger the data fetch if we just opened the manual log
    if (tabId === 'tab-manual') {
        fetchManualLogs();
    }
}


function getRandomColor() {
    const letters = '456789ABCDEF'; let color = '#';
    for (let i = 0; i < 6; i++) { color += letters[Math.floor(Math.random() * 12)]; }
    return color;
}

// Fixed Date Format string!
const chartConfigOptions = {
    responsive: true, maintainAspectRatio: false, layout: { padding: { bottom: 50 } },
    interaction: { mode: 'nearest', intersect: false },
    plugins: { zoom: { pan: { enabled: true, mode: 'x' }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' } } },
    scales: { 
        x: { 
            type: 'time', 
            time: { 
                tooltipFormat: 'PP pp',
                displayFormats: { minute: 'h:mm a', hour: 'MMM d, h a', day: 'MMM d' }
            }, 
            ticks: { color: '#bdc3c7', font: { size: 14, weight: 'bold' }, maxRotation: 0, autoSkipPadding: 20 }, 
            grid: { color: 'rgba(236, 240, 241, 0.1)' } 
        } 
    }
};

function generateStatsHTML(datasets) {
    let html = '';
    datasets.forEach(ds => {
        if (ds.data.length === 0) return;
        let values = ds.data.map(d => d.y).filter(v => v !== null && !isNaN(v));
        if (values.length === 0) return;
        
        let current = values[values.length - 1].toFixed(2);
        let min = Math.min(...values).toFixed(2);
        let max = Math.max(...values).toFixed(2);
        let avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
        
        html += `<div class="chart-stat-badge" style="border-left-color: ${ds.borderColor}">
                    <strong>${ds.label}:</strong> Cur: ${current} | Min: ${min} | Max: ${max} | Avg: ${avg}
                 </div>`;
    });
    return html;
}

function drawBadges(containerId, prefix, count, dataObj, trueLabel, falseLabel) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    for (let i = 1; i <= count; i++) {
        const key = `${prefix}${i}`;
        if (dataObj[key] && dataObj[key].length > 0) {
            const lastVal = dataObj[key][dataObj[key].length - 1].y;
            const isOn = (lastVal === 1);
            const cssClass = isOn ? 'badge-on' : 'badge-off';
            const text = isOn ? trueLabel : falseLabel;
            container.innerHTML += `<div class="digital-badge ${cssClass}"><span class="dot"></span> ${key.toUpperCase()}: ${text}</div>`;
        } else {
            container.innerHTML += `<div class="digital-badge badge-inactive"><span class="dot"></span> ${key.toUpperCase()}: N/A</div>`;
        }
    }
}

function toggleCustomRes() {
    const res = document.getElementById('res-select').value;
    const container = document.getElementById('custom-res-container');
    if (res === 'custom') { container.style.display = 'inline-block'; } 
    else { container.style.display = 'none'; }
}

function drawCompareChart() {
    if (!flatDataMap || Object.keys(flatDataMap).length === 0) return;
    let key1 = document.getElementById('compare1').value;
    let key2 = document.getElementById('compare2').value;
    if (!key1 || !key2) return;

    let datasets = [];
    if (flatDataMap[key1]) datasets.push({ label: key1, data: flatDataMap[key1], borderColor: '#3498db', backgroundColor: '#3498db33', tension: 0.3, pointRadius: 2, yAxisID: 'y' });
    if (flatDataMap[key2]) datasets.push({ label: (key1 === key2) ? key2 + " (Copy)" : key2, data: flatDataMap[key2], borderColor: '#e74c3c', backgroundColor: '#e74c3c33', tension: 0.3, pointRadius: 2, yAxisID: 'y1' });

    document.getElementById('stats-compare').innerHTML = generateStatsHTML(datasets);

    if (compareChart) compareChart.destroy();
    const ctx = document.getElementById('compareChart').getContext('2d');
    let compOptions = JSON.parse(JSON.stringify(chartConfigOptions));
    
    compOptions.scales.y = { type: 'linear', position: 'left', title: { display: true, text: key1, color: '#3498db', font: {size: 16, weight: 'bold'} }, ticks: { color: '#bdc3c7', font: {size: 14} }, grid: { color: 'rgba(236, 240, 241, 0.1)' } };
    compOptions.scales.y1 = { type: 'linear', position: 'right', title: { display: true, text: key2, color: '#e74c3c', font: {size: 16, weight: 'bold'} }, ticks: { color: '#bdc3c7', font: {size: 14} }, grid: { drawOnChartArea: false } };
    
    compareChart = new Chart(ctx, { type: 'line', data: { datasets: datasets }, options: compOptions });
}

function fetchAndDrawCharts() {
    const start = document.getElementById('start-date').value; 
    const end = document.getElementById('end-date').value;
    const res = document.getElementById('res-select').value;
    
    let url = `/api/data?res=${res}`;
    if (res === 'custom') { url += `&custom_minutes=${document.getElementById('custom-minutes').value}`; }
    if (start && end) url += `&start=${start}&end=${end}`;

    fetch(url)
        .then(async response => {
            // 1. If the server throws a 400 (our safety valve) or 504 (timeout)
            if (!response.ok) {
                // Try to read our custom Python JSON error message
                const isJson = response.headers.get('content-type')?.includes('application/json');
                if (isJson) {
                    const errData = await response.json();
                    throw new Error(errData.message); // Throw our clean Python error
                } else {
                    throw new Error(`Server overloaded or timed out (${response.status}). Please try a smaller date range.`);
                }
            }
            return response.json();
        })
        .then(data => {
            // 2. Just in case it returned a 200 OK but still contained an error
            if (data.status === 'error') {
                throw new Error(data.message);
            }

        // --- PROCEED WITH CHART DRAWING ---
        globalChartData = data;
        const sensors = data.sensors || {};
        const system = data.system || {};
        const voltages = data.voltages || {};
        const emiSys = data.emi_sys || {};
        const emiDig = data.emi_digital || {};



        flatDataMap = {};
        Object.assign(flatDataMap, sensors); Object.assign(flatDataMap, system); Object.assign(flatDataMap, voltages); Object.assign(flatDataMap, emiSys); Object.assign(flatDataMap, emiDig); 

        let c1 = document.getElementById('compare1'); let c2 = document.getElementById('compare2');
        let val1 = c1.value; let val2 = c2.value;
        c1.innerHTML = ''; c2.innerHTML = '';
        let keys = Object.keys(flatDataMap).sort();
        keys.forEach(k => { c1.add(new Option(k, k)); c2.add(new Option(k, k)); });
        if (keys.includes(val1)) c1.value = val1; else c1.selectedIndex = 0;
        if (keys.includes(val2)) c2.value = val2; else if (keys.length > 1) c2.selectedIndex = 1;
        drawCompareChart();

        if (system["CPU Temp (°C)"] && system["CPU Temp (°C)"].length > 0) {
            const lastIdx = system["CPU Temp (°C)"].length - 1;
            document.getElementById('hud-temp').innerText = system["CPU Temp (°C)"][lastIdx].y + "°C";
            document.getElementById('hud-pi-up').innerText = system["Uptime (Hrs)"][lastIdx].y + "h";
            document.getElementById('hud-cpu').innerText = system["CPU Usage (%)"][lastIdx].y + "%";
            document.getElementById('hud-ram').innerText = system["RAM Usage (%)"][lastIdx].y + "%";
        }
        if (emiSys["Uptime (Days)"] && emiSys["Uptime (Days)"].length > 0) {
            const lastIdx = emiSys["Uptime (Days)"].length - 1;
            document.getElementById('hud-emi-up').innerText = emiSys["Uptime (Days)"][lastIdx].y + "d";
            document.getElementById('hud-emi-mem').innerText = emiSys["Mem Usage (%)"][lastIdx].y + "%";
        }

        drawBadges('grid-relays', 'r', 4, emiDig, 'ON', 'OFF');
        drawBadges('grid-alarms', 'a', 5, emiDig, 'TRIGGERED', 'CLEAR');
        drawBadges('grid-gpios', 'io', 6, emiDig, 'HIGH', 'LOW');

        const sensorDatasets = [];
        for (const [sensorId, readings] of Object.entries(sensors)) {
            const isHumidity = sensorId.includes("Humidity");
            let sensorColor = isHumidity ? '#3498db' : getRandomColor();
            sensorDatasets.push({ label: sensorId, data: readings, borderColor: sensorColor, backgroundColor: sensorColor + '33', tension: 0.3, pointRadius: 3, yAxisID: isHumidity ? 'y1' : 'y' });
        }
        document.getElementById('stats-sensors').innerHTML = generateStatsHTML(sensorDatasets);
        if (myChart) myChart.destroy();
        const ctx1 = document.getElementById('sensorChart').getContext('2d');
        let envOptions = JSON.parse(JSON.stringify(chartConfigOptions));
        envOptions.scales.y = { type: 'linear', position: 'left', title: { display: true, text: 'Temperature (°C)', color: '#ecf0f1', font: {size: 16, weight: 'bold'} }, ticks: { color: '#bdc3c7', font: {size: 14} }, grid: { color: 'rgba(236, 240, 241, 0.1)' } };
        envOptions.scales.y1 = { type: 'linear', position: 'right', title: { display: true, text: 'Humidity (%)', color: '#3498db', font: {size: 16, weight: 'bold'} }, ticks: { color: '#bdc3c7', font: {size: 14} }, grid: { drawOnChartArea: false } };
        myChart = new Chart(ctx1, { type: 'line', data: { datasets: sensorDatasets }, options: envOptions });

        const voltDatasets = [];
        for (const [vmId, readings] of Object.entries(voltages)) {
            if(readings.length > 0) { let vColor = getRandomColor(); voltDatasets.push({ label: vmId, data: readings, borderColor: vColor, backgroundColor: vColor + '33', tension: 0.3, pointRadius: 2 }); }
        }
        document.getElementById('stats-voltages').innerHTML = generateStatsHTML(voltDatasets);
        if (voltChart) voltChart.destroy();
        const ctx3 = document.getElementById('voltageChart').getContext('2d');
        let vOptions = JSON.parse(JSON.stringify(chartConfigOptions));
        vOptions.scales.y = { type: 'linear', title: { display: true, text: 'Voltage (V)', color: '#ecf0f1', font: {size: 16, weight: 'bold'} }, ticks: { color: '#bdc3c7', font: {size: 14} }, grid: { color: 'rgba(236, 240, 241, 0.1)' } };
        voltChart = new Chart(ctx3, { type: 'line', data: { datasets: voltDatasets }, options: vOptions });

        const sysDatasets = [];
        const sysColors = { "CPU Temp (°C)": "#e74c3c", "CPU Usage (%)": "#f1c40f", "RAM Usage (%)": "#2ecc71", "Disk Usage (%)": "#9b59b6" };
        for (const [key, color] of Object.entries(sysColors)) {
            if (system[key] && system[key].length > 0) sysDatasets.push({ label: key, data: system[key], borderColor: color, backgroundColor: color + '33', tension: 0.3, pointRadius: 0 });
        }
        document.getElementById('stats-system').innerHTML = generateStatsHTML(sysDatasets);
        if (sysChart) sysChart.destroy();
        const ctx2 = document.getElementById('systemChart').getContext('2d');
        let sysOptions = JSON.parse(JSON.stringify(chartConfigOptions));
        sysOptions.scales.y = { type: 'linear', min: 0, max: 100, title: { display: true, text: 'Percentage (%) / Temp (°C)', color: '#ecf0f1', font: {size: 16, weight: 'bold'} }, ticks: { color: '#bdc3c7', font: {size: 14} }, grid: { color: 'rgba(236, 240, 241, 0.1)' } };
        sysOptions.interaction.mode = 'index'; 
        sysChart = new Chart(ctx2, { type: 'line', data: { datasets: sysDatasets }, options: sysOptions });

        const emiSysDatasets = [];
        const emiColors = { "Mem Usage (%)": "#3498db", "Disk Usage (%)": "#e67e22" };
        for (const [key, color] of Object.entries(emiColors)) {
            if (emiSys[key] && emiSys[key].length > 0) emiSysDatasets.push({ label: key, data: emiSys[key], borderColor: color, backgroundColor: color + '33', tension: 0.3, pointRadius: 0 });
        }
        document.getElementById('stats-emi-sys').innerHTML = generateStatsHTML(emiSysDatasets);
        if (emiSysChart) emiSysChart.destroy();
        const ctx4 = document.getElementById('emiSysChart').getContext('2d');
        let emiSysOptions = JSON.parse(JSON.stringify(chartConfigOptions));
        emiSysOptions.scales.y = { type: 'linear', min: 0, max: 100, title: { display: true, text: 'Percentage (%)', color: '#ecf0f1', font: {size: 16, weight: 'bold'} }, ticks: { color: '#bdc3c7', font: {size: 14} }, grid: { color: 'rgba(236, 240, 241, 0.1)' } };
        emiSysOptions.interaction.mode = 'index';
        emiSysChart = new Chart(ctx4, { type: 'line', data: { datasets: emiSysDatasets }, options: emiSysOptions });
    })
    .catch(error => {
        console.error('Error loading chart data:', error);
        alert("⚠️ Chart Error: " + error.message);
     });
}


function downloadCSV() {
    if (!globalChartData) { alert("Data hasn't finished loading yet."); return; }
    const exportType = document.getElementById('csv-select').value;
    let combinedDataSets = {};
    if (exportType === 'sensors' || exportType === 'all') Object.assign(combinedDataSets, globalChartData.sensors);
    if (exportType === 'voltages' || exportType === 'all') Object.assign(combinedDataSets, globalChartData.voltages);
    if (exportType === 'system' || exportType === 'all') Object.assign(combinedDataSets, globalChartData.system);
    if (exportType === 'emi_sys' || exportType === 'all') Object.assign(combinedDataSets, globalChartData.emi_sys);
    if (exportType === 'emi_digital' || exportType === 'all') Object.assign(combinedDataSets, globalChartData.emi_digital);

    let timestampMap = {}; let columns = ["Timestamp"];
    for (const [columnName, dataArray] of Object.entries(combinedDataSets)) {
        columns.push(columnName);
        dataArray.forEach(point => { if (!timestampMap[point.x]) timestampMap[point.x] = {}; timestampMap[point.x][columnName] = point.y; });
    }
    let sortedTimestamps = Object.keys(timestampMap).sort();
    let csvContent = columns.join(",") + "\n";
    sortedTimestamps.forEach(time => {
        let row = [time];
        for (let i = 1; i < columns.length; i++) { let val = timestampMap[time][columns[i]]; row.push(val !== undefined ? val : ""); }
        csvContent += row.join(",") + "\n";
    });
    let blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    let link = document.createElement("a"); let url = URL.createObjectURL(blob);
    link.setAttribute("href", url); let cleanRes = document.getElementById('res-select').value;
    link.setAttribute("download", `PiZero_${exportType}_${cleanRes}_data.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

function resetZoom() { 
    if (myChart) myChart.resetZoom(); if (voltChart) voltChart.resetZoom();
    if (sysChart) sysChart.resetZoom(); if (emiSysChart) emiSysChart.resetZoom(); 
    if (compareChart) compareChart.resetZoom();
}

function toggleRelay(relayId, action) {

if (!confirm(`Are you sure you want to turn ${action.toUpperCase()} Relay ${relayId}?`)) {
        return; // Stop if they click Cancel
    }

    const statusText = document.getElementById('relay-status'); 
    statusText.innerText = `Sending command...`;
    
    fetch(`/api/relay/${relayId}/${action}`)
        .then(r => r.json())
        .then(d => { 
            statusText.innerText = d.status === "success" ? `Relay ${relayId} is now ${d.state}` : `Error: ${d.message}`; 
        })
        .catch(e => statusText.innerText = "Failed to connect to Pi.");
}

function setDefaultDates(hours) {
    const end = new Date(); const start = new Date(end.getTime() - (hours * 60 * 60 * 1000));
    const formatDt = (d) => { d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
    document.getElementById('start-date').value = formatDt(start); document.getElementById('end-date').value = formatDt(end);
}

function loadBackups() {
    fetch('/api/backups')
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById('backup-list');
            if (data.status === 'success') {
                if (data.files.length === 0) {
                    container.innerHTML = '<div style="text-align: center; color: #e74c3c; padding: 20px;">No backups found on the USB drive.</div>';
                    return;
                }
                
                let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';
                data.files.forEach(f => {
                    html += `
                    <div style="background: #2c3e50; padding: 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #34495e;">
                        <div>
                            <strong style="color: #ecf0f1; font-size: 16px;">${f.name}</strong><br>
                            <span style="color: #bdc3c7; font-size: 13px;">File Size: ${f.size}</span>
                        </div>
                        <a href="/api/backups/download/${f.name}" class="chart-btn filter-btn" style="text-decoration: none;" download>Download</a>
                    </div>`;
                });
                html += '</div>';
                container.innerHTML = html;
            } else {
                container.innerHTML = `<div style="text-align: center; color: #e74c3c;">Error accessing USB: ${data.message}</div>`;
            }
        })
        .catch(err => console.error('Error fetching backups:', err));
}

////////////////
// Fetch Logs //
////////////////

function fetchLogs() {
    const sensorLogEl = document.getElementById('log-sensor');
    const backupLogEl = document.getElementById('log-backup');
    const flaskLogEl  = document.getElementById('log-flask');
    const nginxLogEl  = document.getElementById('log-nginx');
    const dmesgLogEl  = document.getElementById('log-dmesg');
    const authLogEl   = document.getElementById('log-auth');
    const cronLogEl   = document.getElementById('log-cron');
    const nginxErrEl  = document.getElementById('log-nginx-err');
    const emailLogEl  = document.getElementById('log-email');

    // CRITICAL: Added 'return' here so triggerBackup can wait for it
    return fetch('/api/logs')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // Update text only if it's different to save browser CPU
                if (sensorLogEl) sensorLogEl.textContent = data.sensor_logs || "No sensor data";
                if (backupLogEl) backupLogEl.textContent = data.backup_logs || "No backup data";
                if (flaskLogEl)  flaskLogEl.textContent  = data.flask_logs  || "No Flask data";
                if (nginxLogEl)  nginxLogEl.textContent  = data.nginx_logs  || "No Nginx data";
                if (dmesgLogEl)  dmesgLogEl.textContent  = data.dmesg_logs  || "No hardware data";
                if (authLogEl)   authLogEl.textContent   = data.auth_logs   || "No security data";
                if (cronLogEl)   cronLogEl.textContent   = data.cron_logs   || "No scheduled tasks";
                if (nginxErrEl)  nginxErrEl.textContent  = data.nginx_err_logs || "No Web errors";
                if (emailLogEl)  emailLogEl.textContent  = data.email_logs  || "No email logs found";
            }
        })
        .catch(err => {
            console.error("Log fetch failed:", err);
        });
}

//////////////
// Fetch Watchdog and System Health
//////////////////

// Function to fetch Watchdog and System Health status
function fetchSystemHealth() {
    fetch('/api/system_health')
        .then(res => res.json())
        .then(data => {
            if (data.status !== 'error') {
                const hwEl = document.getElementById('hud-hw-watchdog');
                const swEl = document.getElementById('hud-sw-watchdog');
                const loadEl = document.getElementById('hud-load');

                if (hwEl) hwEl.innerText = data.hardware_watchdog;
                if (loadEl) loadEl.innerText = data.load_average;

                if (swEl) {
                    swEl.innerText = data.software_daemon;
                    // Color code the status: Green for Active, Red for Inactive
                    swEl.style.color = (data.software_daemon === "Active") ? "#2ecc71" : "#e74c3c";
                }
            }
        })
        .catch(err => console.error('Error fetching system health:', err));
}


function downloadManualLog() {
    // This tells the browser to go to the download URL
    window.location.href = '/api/manual_logs/download';
}

async function initDashboard() {
    let timeWindowHours = 24; let defaultRes = "raw";   
    try {
        const response = await fetch('/ui_config.json');
        if (response.ok) { const config = await response.json(); timeWindowHours = config.default_time_window_hours || 24; defaultRes = config.default_resolution || "raw"; }
    } catch (error) { console.warn("Could not load ui_config.json. Using fallback defaults."); }
    setDefaultDates(timeWindowHours); document.getElementById('res-select').value = defaultRes;
    toggleCustomRes(); 
    fetchAndDrawCharts();
    loadBackups();
    fetchLogs();
    fetchTags();

// --- ADDED FOR WATCHDOG ---
    fetchSystemHealth();
    setInterval(fetchSystemHealth, 30000); // Update every 30 seconds

}

initDashboard();

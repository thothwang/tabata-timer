// --- 1. SETTINGS & STATE ---
let config = {
    exercises: 8,
    work: 20,
    rest: 10,
    rounds: 4,
    roundRest: 60
};

// The "State Machine"
let state = {
    isRunning: false,
    isPaused: false,
    phase: 'IDLE', // IDLE, GET_READY, WORK, REST, ROUND_REST, FINISHED
    timeLeft: 0,
    currentRound: 1,
    currentExercise: 1,
    timerId: null,
    totalDuration: 0 // Track total time for history
};

// UI Elements Cache
const views = {
    setup: document.getElementById('setup-view'),
    timer: document.getElementById('timer-view'),
    history: document.getElementById('history-view')
};

const displays = {
    status: document.getElementById('disp-status'),
    time: document.getElementById('disp-time'),
    round: document.getElementById('disp-round'),
    exercise: document.getElementById('disp-exercise'),
    next: document.getElementById('disp-next')
};

// --- 2. VIEW NAVIGATION ---
function switchView(viewName) {
    // Hide all
    Object.values(views).forEach(v => v.classList.remove('active'));
    // Show target
    views[viewName].classList.add('active');
}

// --- 3. CORE LOGIC (The State Machine) ---
function startWorkout() {
    // 1. Read Inputs
    config.exercises = parseInt(document.getElementById('cfg-exercises').value);
    config.work = parseInt(document.getElementById('cfg-work').value);
    config.rest = parseInt(document.getElementById('cfg-rest').value);
    config.rounds = parseInt(document.getElementById('cfg-rounds').value);
    config.roundRest = parseInt(document.getElementById('cfg-round-rest').value);

    // 2. Initialize State
    state.currentRound = 1;
    state.currentExercise = 1;
    state.totalDuration = 0;
    state.isPaused = false;
    
    // 3. Enter "Get Ready" Phase
    setPhase('GET_READY');
    switchView('timer');
    startTimerLoop();
    
    // Prevent screen sleep (Wake Lock API)
    requestWakeLock();
}

function setPhase(newPhase) {
    state.phase = newPhase;
    
    // Logic for setting time based on phase
    switch(newPhase) {
        case 'GET_READY':
            state.timeLeft = 5;
            updateDisplay("GET READY", "green");
            speak("Get ready");
            break;
        case 'WORK':
            state.timeLeft = config.work;
            updateDisplay(`WORK ${state.currentExercise}/${config.exercises}`, "#30d158"); // Green
            speak("Start");
            break;
        case 'REST':
            state.timeLeft = config.rest;
            updateDisplay("REST", "#ff9f0a"); // Orange
            speak("Rest");
            break;
        case 'ROUND_REST':
            state.timeLeft = config.roundRest;
            updateDisplay("ROUND BREAK", "#0a84ff"); // Blue
            speak("End of round");
            break;
        case 'FINISHED':
            finishWorkout();
            break;
    }
}

function updateDisplay(statusText, color) {
    displays.status.innerText = statusText;
    displays.status.style.color = color;
    displays.round.innerText = `${state.currentRound}/${config.rounds}`;
    displays.exercise.innerText = `${state.currentExercise}/${config.exercises}`;
    
    // Determine "Next" text
    if (state.phase === 'WORK') displays.next.innerText = "Next: Rest";
    else if (state.phase === 'REST') displays.next.innerText = "Next: Work";
    else if (state.phase === 'ROUND_REST') displays.next.innerText = "Next: New Round";
    
    renderTime();
}

function renderTime() {
    // Format MM:SS
    let m = Math.floor(state.timeLeft / 60).toString().padStart(2, '0');
    let s = (state.timeLeft % 60).toString().padStart(2, '0');
    displays.time.innerText = `${m}:${s}`;
}

// --- 4. TIMER LOOP (Heartbeat) ---
function startTimerLoop() {
    if (state.timerId) clearInterval(state.timerId);
    state.isRunning = true;

    state.timerId = setInterval(() => {
        if (state.isPaused) return;

        // TTS Logic: Count down 3, 2, 1
        if (state.timeLeft === 3) speak("Three");
        if (state.timeLeft === 2) speak("Two");
        if (state.timeLeft === 1) speak("One");
        
        // Halfway Logic
        if (state.phase === 'WORK' && state.timeLeft === Math.floor(config.work / 2)) {
             speak("Halfway there");
        }

        if (state.timeLeft > 0) {
            state.timeLeft--;
            state.totalDuration++;
            renderTime();
        } else {
            // Time is up, transition to next state
            nextState();
        }
    }, 1000);
}

function nextState() {
    // State Transition Logic
    if (state.phase === 'GET_READY') {
        setPhase('WORK');
    } 
    else if (state.phase === 'WORK') {
        if (state.currentExercise < config.exercises) {
            setPhase('REST');
        } else {
            // Exercise Set Complete
            if (state.currentRound < config.rounds) {
                setPhase('ROUND_REST');
            } else {
                setPhase('FINISHED');
            }
        }
    }
    else if (state.phase === 'REST') {
        state.currentExercise++;
        setPhase('WORK');
    }
    else if (state.phase === 'ROUND_REST') {
        state.currentRound++;
        state.currentExercise = 1;
        setPhase('WORK');
    }
}

// --- 5. UTILITIES ---
function speak(text) {
    if ('speechSynthesis' in window) {
        // Cancel previous speech to avoid overlapping
        window.speechSynthesis.cancel();
        let utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US'; 
        window.speechSynthesis.speak(utterance);
    }
}

let wakeLock = null;
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
        }
    } catch (err) {
        console.log("Wake Lock error:", err);
    }
}

function finishWorkout() {
    clearInterval(state.timerId);
    state.isRunning = false;
    speak("Congratulations! Workout complete.");
    
    // Save to History
    saveHistory();
    
    alert("Workout Complete!");
    switchView('setup');
}

function saveHistory() {
    let history = JSON.parse(localStorage.getItem('hiit_history') || "[]");
    let record = {
        date: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString(),
        duration: state.totalDuration,
        rounds: config.rounds,
        exercises: config.exercises
    };
    history.unshift(record); // Add to top
    localStorage.setItem('hiit_history', JSON.stringify(history));
}

// --- 6. EVENT LISTENERS ---
document.getElementById('btn-start').addEventListener('click', startWorkout);

document.getElementById('btn-cancel').addEventListener('click', () => {
    clearInterval(state.timerId);
    state.isRunning = false;
    switchView('setup');
});

document.getElementById('btn-toggle').addEventListener('click', function() {
    state.isPaused = !state.isPaused;
    this.innerText = state.isPaused ? "Resume" : "Pause";
    speak(state.isPaused ? "Paused" : "Resuming");
});

document.getElementById('btn-history').addEventListener('click', () => {
    renderHistoryList();
    switchView('history');
});

document.getElementById('btn-back-history').addEventListener('click', () => {
    switchView('setup');
});

function renderHistoryList() {
    let list = document.getElementById('history-list');
    let history = JSON.parse(localStorage.getItem('hiit_history') || "[]");
    
    if (history.length === 0) {
        list.innerHTML = '<li class="history-item"><span>No history yet...</span></li>';
        return;
    }

    list.innerHTML = history.map(h => `
        <li class="history-item">
            <strong>${h.date}</strong><br>
            <small>${h.rounds} Rounds • ${Math.floor(h.duration/60)}m ${h.duration%60}s</small>
        </li>
    `).join('');
}
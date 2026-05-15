import * as THREE from 'three';

let scene, camera, renderer, analyser, dataArray;
let centerMesh, particles = [];
let audio, audioURL;

let lyricLines = [];
let databaseTimeline = []; 
let currentLineIndex = 0;
let systemMode = "IDLE"; 
const clock = new THREE.Clock();

function init() {
    // 3D SCENE ARCHITECTURE
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020205);
    scene.fog = new THREE.FogExp2(0x020205, 0.03);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 10);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    // Dynamic Central Shape Core Element
    const coreGeo = new THREE.IcosahedronGeometry(2, 1);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true });
    centerMesh = new THREE.Mesh(coreGeo, coreMat);
    scene.add(centerMesh);

    // UI RUNTIME INTERACTION BINDINGS
    const fileInput = document.getElementById('upload');
    const startSyncBtn = document.getElementById('start-sync-btn');
    const playPreviewBtn = document.getElementById('play-preview-btn');
    const exportBtn = document.getElementById('export-btn');

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            audioURL = URL.createObjectURL(e.target.files[0]);
            document.getElementById('file-name-display').innerText = e.target.files[0].name;
            document.getElementById('song-title').innerText = e.target.files[0].name.split('.')[0];
            startSyncBtn.style.display = 'block';
        }
    });

    startSyncBtn.addEventListener('click', launchRecordSession);
    playPreviewBtn.addEventListener('click', startFinalPlaybackMode);
    exportBtn.addEventListener('click', exportLRCFile);

    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('resize', onWindowResize);
    
    animate();
}

function launchRecordSession() {
    const rawText = document.getElementById('raw-lyrics').value.trim();
    if (!rawText) return alert("Please paste your text lines first!");

    lyricLines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    document.getElementById('creator-panel').style.display = 'none';
    document.getElementById('playback-stage').style.display = 'block';
    document.getElementById('tap-instruction').style.display = 'block';

    systemMode = "RECORDING";
    currentLineIndex = 0;
    databaseTimeline = [];

    audio = new Audio(audioURL);
    attachAudioAnalyser(audio);
    audio.play();

    showRecordingCue();
}

function showRecordingCue() {
    if (currentLineIndex < lyricLines.length) {
        const current = lyricLines[currentLineIndex];
        const next = lyricLines[currentLineIndex + 1] || "--- END OF LYRICS ---";
        document.getElementById('lyric-screen').innerHTML = `
            <span class="active-cue">${current}</span>
            <div class="next-peek">NEXT: ${next}</div>
        `;
    }
}

function handleKeyPress(e) {
    if (e.code !== 'Space') return;
    
    if (systemMode === "RECORDING") {
        e.preventDefault();
        
        databaseTimeline.push({
            time: audio.currentTime,
            text: lyricLines[currentLineIndex]
        });

        currentLineIndex++;

        if (currentLineIndex >= lyricLines.length) {
            systemMode = "IDLE";
            audio.pause();
            document.getElementById('tap-instruction').style.display = 'none';
            document.getElementById('post-sync-controls').style.display = 'block';
            document.getElementById('lyric-screen').innerText = "Timeline Stamped Successfully!";
        } else {
            showRecordingCue();
        }
    }
}

function startFinalPlaybackMode() {
    document.getElementById('post-sync-controls').style.display = 'none';
    document.getElementById('tap-instruction').style.display = 'none'; 
    
    systemMode = "PLAYBACK";
    
    // Fresh Audio Context instantiation loop wrapper fix
    audio = new Audio(audioURL);
    attachAudioAnalyser(audio);
    
    audio.currentTime = 0;
    audio.play();
}

function exportLRCFile() {
    let lrcOutputArray = [];
    
    databaseTimeline.forEach(item => {
        const minutes = Math.floor(item.time / 60).toString().padStart(2, '0');
        const seconds = Math.floor(item.time % 60).toString().padStart(2, '0');
        const hundredths = Math.floor((item.time % 1) * 100).toString().padStart(2, '0');
        
        lrcOutputArray.push(`[${minutes}:${seconds}.${hundredths}]${item.text}`);
    });

    const lrcContent = lrcOutputArray.join('\n');
    const blob = new Blob([lrcContent], { type: 'text/plain' });
    const link = document.createElement('a');
    
    link.download = `${document.getElementById('song-title').innerText}.lrc`;
    link.href = window.URL.createObjectURL(blob);
    link.click();
}

function attachAudioAnalyser(audioElement) {
    // If context structure exists old analyzer nodes map targets safely run cleanup
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const source = ctx.createMediaElementSource(audioElement);
    analyser = ctx.createAnalyser();
    source.connect(analyser);
    analyser.connect(ctx.destination);
    analyser.fftSize = 128;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
}

function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();

    let bass = 0;
    if (analyser) {
        analyser.getByteFrequencyData(dataArray);
        bass = dataArray[2] / 255;
        const scaleNode = 1 + bass * 0.4;
        centerMesh.scale.set(scaleNode, scaleNode, scaleNode);
    }
    centerMesh.rotation.x = elapsed * 0.3;
    centerMesh.rotation.y = elapsed * 0.5;

    if (systemMode === "PLAYBACK" && audio) {
        const timeNow = audio.currentTime;
        let activeText = "";

        for (let i = 0; i < databaseTimeline.length; i++) {
            if (timeNow >= databaseTimeline[i].time) {
                activeText = databaseTimeline[i].text;
            }
        }

        const screenNode = document.getElementById('lyric-screen');
        if (screenNode.innerText !== activeText && activeText !== "") {
            screenNode.innerHTML = `<span class="video-rendered-text">${activeText}</span>`;
        }
        
        if (audio.ended) {
            systemMode = "IDLE";
            document.getElementById('post-sync-controls').style.display = 'block';
            screenNode.innerText = "Experience Ended.";
        }
    }

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

init();

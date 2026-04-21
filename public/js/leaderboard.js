const socket = io();

const leaderboardList = document.getElementById('leaderboard-list');

// Character emoji mapping for display
const charMap = {
    'duck': '🦆',
    'dog': '🐶',
    'trex': '🦖',
    'turtle': '🐢',
    'bunny': '🐰',
    'horse': '🐴',
    'cow': '🐮'
};

socket.on('update_leaderboard', (scores) => {
    // Clear list
    leaderboardList.innerHTML = '';
    
    if (scores.length === 0) {
        leaderboardList.innerHTML = '<div class="lb-row empty-state">Waiting for runners...</div>';
        return;
    }

    scores.forEach((entry, index) => {
        const row = document.createElement('div');
        const rankClass = index < 3 ? `rank-${index + 1}` : '';
        row.className = `lb-row ${rankClass}`;
        // stagger animation
        row.style.animationDelay = `${index * 0.1}s`;
        
        row.innerHTML = `
            <div class="rank-val">#${index + 1}</div>
            <div class="player-name">${entry.playerName}</div>
            <div class="char-val">${charMap[entry.character] || '🦆'}</div>
            <div class="score-val">${entry.score}</div>
        `;
        
        leaderboardList.appendChild(row);
    });
});

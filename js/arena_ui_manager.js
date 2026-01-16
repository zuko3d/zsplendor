class ArenaUIManager {
    constructor(controller) {
        this.controller = controller;
        this.modal = null;
        this.botEditorModal = null;
        this.currentEditIndex = -1;
        
        this.initUI();
    }
    
    initUI() {
        // Create modal elements if they don't exist
        if (!document.getElementById('arena-modal')) {
            this.createArenaModal();
        }
        if (!document.getElementById('bot-editor-modal')) {
            this.createBotEditorModal();
        }
        
        this.modal = document.getElementById('arena-modal');
        this.botEditorModal = document.getElementById('bot-editor-modal');
        
        // Close buttons
        this.modal.querySelector('.close-btn').onclick = () => this.hide();
        this.botEditorModal.querySelector('.close-btn').onclick = () => this.hideBotEditor();
        
        // Add bot button
        document.getElementById('add-bot-btn').onclick = () => this.showBotEditor(-1);
        
        // Run tournament button
        document.getElementById('run-tournament-btn').onclick = () => this.runTournament();
    }
    
    createArenaModal() {
        const modal = document.createElement('div');
        modal.id = 'arena-modal';
        modal.className = 'modal';
        modal.style.display = 'none';
        
        modal.innerHTML = `
            <div class="arena-content">
                <div class="arena-header">
                    <h2>Bot Arena</h2>
                    <button class="close-btn">&times;</button>
                </div>
                <div id="arena-body">
                    <div class="arena-section">
                        <h3>Bots</h3>
                        <div id="bot-list"></div>
                        <button id="add-bot-btn" class="action-btn">+ Add Bot</button>
                    </div>
                    
                    <div class="arena-section">
                        <h3>Tournament Settings</h3>
                        <div class="form-group">
                            <label>Games per Matchup:</label>
                            <input type="number" id="games-per-matchup" value="10" min="1" max="100">
                        </div>
                        <div class="form-group">
                            <label>Worker Threads:</label>
                            <input type="number" id="worker-count" value="8" min="1" max="16">
                            <small style="color: #888;">More threads = faster execution (recommended: 4-8)</small>
                        </div>
                        
                        <h4 style="margin-top: 15px; margin-bottom: 10px; color: #aaa;">Global Bot Settings</h4>
                        <div class="form-group">
                            <label>Iterations Limit (per move):</label>
                            <input type="number" id="global-iterations-limit" value="100000" min="1000" max="10000000" step="1000">
                            <small style="color: #888;">MCTS iterations limit for all bots (default: 100,000)</small>
                        </div>
                        <div class="form-group">
                            <label>Time Limit (seconds per move):</label>
                            <input type="number" id="global-time-limit" value="2.5" min="0.1" max="60" step="0.1">
                            <small style="color: #888;">Time limit for all bots (default: 2.5s)</small>
                        </div>
                        
                        <button id="run-tournament-btn" class="primary-btn">Run Tournament</button>
                        <div id="tournament-progress" class="hidden">
                            <div class="progress-info">
                                <span id="progress-text">Running tournament...</span>
                            </div>
                            <div class="progress-bar-container">
                                <div id="progress-bar" class="progress-bar"></div>
                            </div>
                            <div class="progress-details">
                                <span id="progress-matches">0 / 0 matches</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="arena-section" id="results-section" style="display: none;">
                        <h3>Results</h3>
                        <div id="results-container"></div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    createBotEditorModal() {
        const modal = document.createElement('div');
        modal.id = 'bot-editor-modal';
        modal.className = 'modal';
        modal.style.display = 'none';
        
        modal.innerHTML = `
            <div class="modal-content bot-editor-content">
                <div class="arena-header">
                    <h2 id="bot-editor-title">Edit Bot</h2>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="form-group">
                    <label>Name:</label>
                    <input type="text" id="bot-name">
                </div>
                <div class="form-group">
                    <label>Profile:</label>
                    <select id="bot-profile">
                        <option value="Balanced">Balanced</option>
                        <option value="Aggressive">Aggressive</option>
                        <option value="Economic">Economic</option>
                        <option value="Flexible">Flexible</option>
                        <option value="Custom">Custom</option>
                    </select>
                </div>
                
                <div id="custom-settings" style="display: none;">
                    <h4 style="margin-top: 15px; margin-bottom: 10px; color: #aaa;">MCTS Parameters</h4>
                    <div class="form-group">
                        <label>Exploration Parameter:</label>
                        <input type="number" id="bot-exploration" step="0.1" value="24.1" min="0">
                    </div>
                    
                    <h4 style="margin-top: 15px; margin-bottom: 10px; color: #aaa;">Score Weights</h4>
                    
                    <div class="form-group">
                        <label>VP Weights (16 values, 0-15 points):</label>
                        <input type="text" id="bot-vp-weights" value="0,10,20,30,40,60,80,200,500,700,900,1500,2000,3000,10000,100000" style="font-size: 0.85em;">
                        <small style="color: #888;">Comma-separated values for 0-15 victory points</small>
                    </div>
                    
                    <div class="form-group">
                        <label>Gem Weights (23 values, 0-22 gems):</label>
                        <input type="text" id="bot-gem-weights" value="0,10,19,27,34,40,45,49,52,55,57,59,60,61,62,63,64,65,66,67,68,69,70" style="font-size: 0.85em;">
                        <small style="color: #888;">Comma-separated values for 0-22 gems</small>
                    </div>
                    
                    <div class="weights-grid">
                        <div class="form-group">
                            <label>Demand Multiplier:</label>
                            <input type="number" id="bot-demand-mult" step="0.1" value="-1.0">
                        </div>
                        <div class="form-group">
                            <label>Bonus Multiplier:</label>
                            <input type="number" id="bot-bonus-mult" step="0.1" value="18.0">
                        </div>
                        <div class="form-group">
                            <label>Gem Multiplier:</label>
                            <input type="number" id="bot-gem-mult" step="0.1" value="0.5">
                        </div>
                        <div class="form-group">
                            <label>Win Reward:</label>
                            <input type="number" id="bot-win-reward" step="1000" value="100000">
                        </div>
                        <div class="form-group">
                            <label>Loss Reward:</label>
                            <input type="number" id="bot-loss-reward" step="1000" value="-100000">
                        </div>
                    </div>
                </div>
                
                <div class="editor-actions">
                    <button id="save-bot-btn" class="primary-btn">Save</button>
                    <button id="cancel-bot-btn" class="secondary-btn">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Event listeners
        document.getElementById('bot-profile').onchange = (e) => {
            const isCustom = e.target.value === 'Custom';
            document.getElementById('custom-settings').style.display = isCustom ? 'block' : 'none';
        };
        
        document.getElementById('save-bot-btn').onclick = () => this.saveBot();
        document.getElementById('cancel-bot-btn').onclick = () => this.hideBotEditor();
    }
    
    show() {
        this.modal.style.display = 'flex';
        this.renderBotList();
    }
    
    hide() {
        this.modal.style.display = 'none';
    }
    
    renderBotList() {
        const container = document.getElementById('bot-list');
        container.innerHTML = '';
        
        if (this.controller.bots.length === 0) {
            container.innerHTML = '<p class="empty-message">No bots added yet.</p>';
            return;
        }
        
        this.controller.bots.forEach((bot, index) => {
            const item = document.createElement('div');
            item.className = 'bot-list-item';
            item.innerHTML = `
                <div class="bot-info">
                    <strong>${bot.name}</strong>
                    <span class="bot-profile-badge">${bot.isProfile ? bot.profile : 'Custom'}</span>
                </div>
                <div class="bot-actions">
                    <button class="icon-btn edit-bot-btn" data-index="${index}">✎</button>
                    <button class="icon-btn remove-bot-btn" data-index="${index}">×</button>
                </div>
            `;
            container.appendChild(item);
        });
        
        // Add listeners
        container.querySelectorAll('.edit-bot-btn').forEach(btn => {
            btn.onclick = () => this.showBotEditor(parseInt(btn.dataset.index));
        });
        container.querySelectorAll('.remove-bot-btn').forEach(btn => {
            btn.onclick = () => {
                this.controller.removeBot(parseInt(btn.dataset.index));
                this.renderBotList();
            };
        });
        
        // Update run button state
        const runBtn = document.getElementById('run-tournament-btn');
        runBtn.disabled = this.controller.bots.length < 2;
    }
    
    showBotEditor(index) {
        this.currentEditIndex = index;
        const title = document.getElementById('bot-editor-title');
        const nameInput = document.getElementById('bot-name');
        const profileSelect = document.getElementById('bot-profile');
        const customSettings = document.getElementById('custom-settings');
        
        if (index === -1) {
            // New bot
            title.textContent = 'Add Bot';
            nameInput.value = `Bot ${this.controller.bots.length + 1}`;
            profileSelect.value = 'Balanced';
            customSettings.style.display = 'none';
        } else {
            // Edit bot
            const bot = this.controller.bots[index];
            title.textContent = 'Edit Bot';
            nameInput.value = bot.name;
            
            if (bot.isProfile) {
                profileSelect.value = bot.profile;
                customSettings.style.display = 'none';
            } else {
                profileSelect.value = 'Custom';
                customSettings.style.display = 'block';
                document.getElementById('bot-exploration').value = bot.explorationParam;
                
                // Load all weight parameters
                if (bot.weights) {
                    const w = bot.weights;
                    document.getElementById('bot-vp-weights').value = w.vpWeights.join(',');
                    document.getElementById('bot-gem-weights').value = w.gemWeights.join(',');
                    document.getElementById('bot-demand-mult').value = w.demandMultiplier;
                    document.getElementById('bot-bonus-mult').value = w.bonusMultiplier;
                    document.getElementById('bot-gem-mult').value = w.gemMultiplier;
                    document.getElementById('bot-win-reward').value = w.winReward;
                    document.getElementById('bot-loss-reward').value = w.lossReward;
                }
            }
        }
        
        this.botEditorModal.style.display = 'flex';
    }
    
    hideBotEditor() {
        this.botEditorModal.style.display = 'none';
    }
    
    saveBot() {
        const name = document.getElementById('bot-name').value;
        const profile = document.getElementById('bot-profile').value;
        
        let config = {
            name: name,
            isProfile: profile !== 'Custom',
            profile: profile
        };
        
        if (profile === 'Custom') {
            config.explorationParam = parseFloat(document.getElementById('bot-exploration').value);
            
            // Parse VP weights
            const vpWeightsStr = document.getElementById('bot-vp-weights').value;
            const vpWeights = vpWeightsStr.split(',').map(v => parseFloat(v.trim()));
            if (vpWeights.length !== 16) {
                alert('VP Weights must have exactly 16 values (0-15 points)');
                return;
            }
            
            // Parse gem weights
            const gemWeightsStr = document.getElementById('bot-gem-weights').value;
            const gemWeights = gemWeightsStr.split(',').map(v => parseFloat(v.trim()));
            if (gemWeights.length !== 23) {
                alert('Gem Weights must have exactly 23 values (0-22 gems)');
                return;
            }
            
            config.weights = {
                vpWeights: vpWeights,
                gemWeights: gemWeights,
                demandMultiplier: parseFloat(document.getElementById('bot-demand-mult').value),
                bonusMultiplier: parseFloat(document.getElementById('bot-bonus-mult').value),
                gemMultiplier: parseFloat(document.getElementById('bot-gem-mult').value),
                winReward: parseFloat(document.getElementById('bot-win-reward').value),
                lossReward: parseFloat(document.getElementById('bot-loss-reward').value)
            };
        }
        
        try {
            if (this.currentEditIndex === -1) {
                this.controller.addBot(config);
            } else {
                this.controller.updateBot(this.currentEditIndex, config);
            }
            this.hideBotEditor();
            this.renderBotList();
        } catch (e) {
            alert(e.message);
        }
    }
    
    async runTournament() {
        const gamesPerMatchup = parseInt(document.getElementById('games-per-matchup').value);
        const workerCount = parseInt(document.getElementById('worker-count').value);
        const iterationsLimit = parseInt(document.getElementById('global-iterations-limit').value);
        const timeLimit = parseFloat(document.getElementById('global-time-limit').value);
        const progress = document.getElementById('tournament-progress');
        const runBtn = document.getElementById('run-tournament-btn');
        const resultsSection = document.getElementById('results-section');
        
        // Set worker count and global settings
        this.controller.workerCount = workerCount;
        this.controller.globalIterationsLimit = iterationsLimit;
        this.controller.globalTimeLimit = Math.round(timeLimit * 1000); // Convert to milliseconds
        
        // Calculate total games
        const numBots = this.controller.bots.length;
        const totalMatchups = (numBots * (numBots - 1)) / 2;
        const totalGames = totalMatchups * gamesPerMatchup;
        
        progress.classList.remove('hidden');
        runBtn.disabled = true;
        
        // Show results section immediately with initial empty stats
        resultsSection.style.display = 'block';
        this.renderLiveResults();
        
        // Initialize progress display
        document.getElementById('progress-matches').textContent = `0 / ${totalGames} games`;
        document.getElementById('progress-bar').style.width = '0%';
        
        try {
            // Progress callback for progress bar updates
            const progressCallback = (completedGames, totalGames) => {
                const percentage = (completedGames / totalGames * 100).toFixed(1);
                document.getElementById('progress-bar').style.width = `${percentage}%`;
                document.getElementById('progress-matches').textContent = `${completedGames} / ${totalGames} games`;
            };
            
            // Stats callback for table updates (called when game results arrive)
            const statsCallback = () => {
                this.renderLiveResults();
            };
            
            const results = await this.controller.runTournament(gamesPerMatchup, progressCallback, statsCallback);
            
            // Update to 100%
            document.getElementById('progress-bar').style.width = '100%';
            document.getElementById('progress-matches').textContent = `${totalGames} / ${totalGames} games`;
            
            // Final render with complete results
            this.renderResults(results);
        } catch (e) {
            alert("Tournament failed: " + e.message);
            console.error(e);
        } finally {
            progress.classList.add('hidden');
            runBtn.disabled = false;
        }
    }
    
    renderLiveResults() {
        const stats = this.controller.getLiveStats();
        if (!stats) return;
        
        this.renderStatsTable(stats);
    }
    
    renderResults(results) {
        const stats = this.controller.calculateWinRates();
        if (!stats) return;
        
        this.renderStatsTable(stats);
    }
    
    renderStatsTable(stats) {
        const container = document.getElementById('results-container');
        
        let html = `
            <table class="results-table">
                <thead>
                    <tr>
                        <th>Bot Name</th>
                        <th>Games</th>
                        <th>Win Rate</th>
                        <th>MDE (±%)</th>
                        <th>Avg Win Turns</th>
                        <th>Avg Points</th>
                        <th>Avg Turns</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        stats.forEach(s => {
            html += `
                <tr>
                    <td><strong>${s.name}</strong></td>
                    <td>${s.gamesPlayed}</td>
                    <td>
                        <div class="winrate-container">
                            <div class="winrate-bar" style="width: ${s.winRate}%"></div>
                            <span>${s.winRate}%</span>
                        </div>
                    </td>
                    <td>±${s.mde}%</td>
                    <td>${s.avgWinTurns}</td>
                    <td>${s.avgPoints}</td>
                    <td>${s.avgGameLength}</td>
                </tr>
            `;
        });
        
        html += `</tbody></table>`;
        
        // Add head-to-head if more than 2 bots
        if (this.controller.bots.length > 2) {
            // Could add matrix here
        }
        
        container.innerHTML = html;
    }
}
class ArenaController {
    constructor(wasmInterface) {
        this.wasm = wasmInterface;
        this.bots = [];
        this.results = null;
        this.isRunning = false;
        this.arenaWrapper = null;
        this.workerPool = null;
        this.useParallel = true;
        this.workerCount = 8;
        this.globalIterationsLimit = 100000;
        this.globalTimeLimit = 2500; // milliseconds
    }
    
    // Initialize arena wrapper
    initialize() {
        if (this.wasm && this.wasm.module && this.wasm.module.ArenaWrapper) {
            this.arenaWrapper = new this.wasm.module.ArenaWrapper();
        } else {
            console.error("ArenaWrapper not found in WASM module");
        }
    }
    
    // Bot management
    addBot(config) {
        if (this.bots.length >= 8) {
            throw new Error("Maximum 8 bots allowed");
        }
        
        this.bots.push(config);
        
        // Add to WASM wrapper
        if (this.arenaWrapper) {
            if (config.isProfile) {
                this.arenaWrapper.addBotFromProfile(config.profile, config.name);
            } else {
                this.arenaWrapper.addBot(
                    config.name,
                    config.weights,
                    config.explorationParam,
                    config.timeLimit
                );
            }
        }
    }
    
    removeBot(index) {
        if (index >= 0 && index < this.bots.length) {
            this.bots.splice(index, 1);
            // Rebuild wrapper
            this.rebuildWrapper();
        }
    }
    
    updateBot(index, config) {
        if (index >= 0 && index < this.bots.length) {
            this.bots[index] = config;
            this.rebuildWrapper();
        }
    }
    
    rebuildWrapper() {
        if (!this.arenaWrapper) return;
        
        this.arenaWrapper.reset();
        this.bots.forEach(bot => {
            if (bot.isProfile) {
                this.arenaWrapper.addBotFromProfile(bot.profile, bot.name);
            } else {
                this.arenaWrapper.addBot(
                    bot.name,
                    bot.weights,
                    bot.explorationParam,
                    bot.timeLimit
                );
            }
        });
    }
    
    // Predefined profiles
    static getProfiles() {
        return {
            'Balanced': {
                name: 'Balanced',
                description: 'Well-rounded strategy with default weights',
                explorationParam: 24.1,
                timeLimit: 2500
            },
            'Aggressive': {
                name: 'Aggressive',
                description: 'Focuses on high-value cards and quick wins',
                explorationParam: 30.0,
                timeLimit: 2500
            },
            'Economic': {
                name: 'Economic',
                description: 'Builds engine with bonuses before scoring',
                explorationParam: 20.0,
                timeLimit: 2500
            },
            'Flexible': {
                name: 'Flexible',
                description: 'Adapts strategy with high exploration',
                explorationParam: 40.0,
                timeLimit: 2500
            }
        };
    }
    
    // Tournament execution
    async runTournament(gamesPerMatchup, progressCallback) {
        if (this.bots.length < 2) {
            throw new Error("Need at least 2 bots to run tournament");
        }
        
        this.isRunning = true;
        
        try {
            if (this.useParallel && this.workerCount > 1) {
                return await this.runTournamentParallel(gamesPerMatchup, progressCallback);
            } else {
                return await this.runTournamentSequential(gamesPerMatchup);
            }
        } finally {
            this.isRunning = false;
        }
    }
    
    async runTournamentSequential(gamesPerMatchup) {
        if (!this.arenaWrapper) {
            throw new Error("Arena wrapper not initialized");
        }
        
        this.arenaWrapper.setGamesPerMatchup(gamesPerMatchup);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const resultsJSON = this.arenaWrapper.runTournament();
        this.results = JSON.parse(resultsJSON);
        return this.results;
    }
    
    async runTournamentParallel(gamesPerMatchup, progressCallback) {
        // Initialize worker pool if needed
        if (!this.workerPool) {
            this.workerPool = new ArenaWorkerPool(this.workerCount);
            await this.workerPool.initialize();
        }
        
        // Create tasks for all matchups
        const tasks = [];
        for (let i = 0; i < this.bots.length; i++) {
            for (let j = i + 1; j < this.bots.length; j++) {
                tasks.push({
                    matchupId: `bot${i}_vs_bot${j}`,
                    bot1: this.getBotConfig(i),
                    bot2: this.getBotConfig(j),
                    bot1Index: i,
                    bot2Index: j,
                    gamesPerMatchup
                });
            }
        }
        
        // Run tasks in parallel
        const matchupResults = await this.workerPool.runTasks(tasks, progressCallback);
        
        // Aggregate results
        this.results = this.aggregateResults(matchupResults, gamesPerMatchup);
        return this.results;
    }
    
    getBotConfig(index) {
        const bot = this.bots[index];
        if (bot.isProfile) {
            // Get default weights for profile
            const profiles = ArenaController.getProfiles();
            const profile = profiles[bot.profile];
            return {
                name: bot.name,
                explorationParam: profile.explorationParam,
                timeLimit: this.globalTimeLimit, // Use global time limit
                iterationsLimit: this.globalIterationsLimit, // Use global iterations limit
                weights: this.getDefaultWeights()
            };
        } else {
            return {
                name: bot.name,
                explorationParam: bot.explorationParam,
                timeLimit: this.globalTimeLimit, // Use global time limit
                iterationsLimit: this.globalIterationsLimit, // Use global iterations limit
                weights: bot.weights
            };
        }
    }
    
    getDefaultWeights() {
        return {
            vpWeights: [0, 10, 20, 30, 40, 60, 80, 200, 500, 700, 900, 1500, 2000, 3000, 10000, 100000],
            gemWeights: [0, 10, 19, 27, 34, 40, 45, 49, 52, 55, 57, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70],
            demandMultiplier: -1.0,
            bonusMultiplier: 18.0,
            gemMultiplier: 0.5,
            winReward: 100000.0,
            lossReward: -100000.0
        };
    }
    
    aggregateResults(matchupResults, gamesPerMatchup) {
        const results = {
            bots: this.bots.map(b => ({ name: b.name })),
            matches: [],
            wins: new Array(this.bots.length).fill(0),
            losses: new Array(this.bots.length).fill(0),
            gamesPlayed: new Array(this.bots.length).fill(0),
            totalPoints: new Array(this.bots.length).fill(0),
            totalWinTurns: new Array(this.bots.length).fill(0),
            avgGameLength: new Array(this.bots.length).fill(0),
            avgPointsScored: new Array(this.bots.length).fill(0),
            avgWinTurns: new Array(this.bots.length).fill(0)
        };
        
        // Collect all match results
        matchupResults.forEach(matchup => {
            matchup.results.forEach(game => {
                results.matches.push(game);
                
                const bot1Idx = game.bot1Index;
                const bot2Idx = game.bot2Index;
                
                results.gamesPlayed[bot1Idx]++;
                results.gamesPlayed[bot2Idx]++;
                
                if (game.winner === 0) {
                    results.wins[bot1Idx]++;
                    results.losses[bot2Idx]++;
                    results.totalWinTurns[bot1Idx] += game.turnCount;
                } else {
                    results.losses[bot1Idx]++;
                    results.wins[bot2Idx]++;
                    results.totalWinTurns[bot2Idx] += game.turnCount;
                }
                
                results.totalPoints[bot1Idx] += game.bot1Points;
                results.totalPoints[bot2Idx] += game.bot2Points;
            });
        });
        
        // Calculate averages
        const totalTurns = new Array(this.bots.length).fill(0);
        results.matches.forEach(game => {
            totalTurns[game.bot1Index] += game.turnCount;
            totalTurns[game.bot2Index] += game.turnCount;
        });
        
        for (let i = 0; i < this.bots.length; i++) {
            if (results.gamesPlayed[i] > 0) {
                results.avgPointsScored[i] = results.totalPoints[i] / results.gamesPlayed[i];
                results.avgGameLength[i] = totalTurns[i] / results.gamesPlayed[i];
            }
            if (results.wins[i] > 0) {
                results.avgWinTurns[i] = results.totalWinTurns[i] / results.wins[i];
            }
        }
        
        return results;
    }
    
    // Results processing
    calculateWinRates() {
        if (!this.results) return null;
        
        return this.results.bots.map((bot, idx) => {
            const wins = this.results.wins[idx];
            const losses = this.results.losses[idx];
            const gamesPlayed = this.results.gamesPlayed[idx];
            const total = wins + losses;
            const winRate = total > 0 ? (wins / total * 100).toFixed(1) : 0;
            const avgWinTurns = this.results.avgWinTurns[idx] > 0 ? this.results.avgWinTurns[idx].toFixed(1) : 'N/A';
            
            return {
                name: bot.name,
                wins,
                losses,
                gamesPlayed,
                winRate: parseFloat(winRate),
                avgPoints: this.results.avgPointsScored[idx].toFixed(1),
                avgGameLength: this.results.avgGameLength[idx].toFixed(1),
                avgWinTurns: avgWinTurns
            };
        });
    }
    
    getHeadToHead(bot1Idx, bot2Idx) {
        if (!this.results) return null;
        
        const matches = this.results.matches.filter(m => 
            (m.bot1Index === bot1Idx && m.bot2Index === bot2Idx) ||
            (m.bot1Index === bot2Idx && m.bot2Index === bot1Idx)
        );
        
        let bot1Wins = 0;
        let bot2Wins = 0;
        
        matches.forEach(m => {
            if (m.bot1Index === bot1Idx) {
                if (m.winner === 0) bot1Wins++;
                else bot2Wins++;
            } else {
                if (m.winner === 0) bot2Wins++;
                else bot1Wins++;
            }
        });
        
        return { bot1Wins, bot2Wins, totalGames: matches.length };
    }
}
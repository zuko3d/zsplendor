// Arena Worker - Runs arena matches in a separate thread
let wasmModule = null;
let arenaWrapper = null;

// Load WASM module
self.addEventListener('message', async (e) => {
    const { type, data } = e.data;
    
    if (type === 'INIT') {
        try {
            const wasmBase = data.wasmPath.split('?')[0].replace(/[^/]*$/, '');
            console.log('Worker: wasmBase calculated as:', wasmBase);
            
            // Import WASM module
            console.log('Worker: Importing script from:', data.wasmPath);
            importScripts(data.wasmPath);
            
            // Configure module
            const config = {
                locateFile: (path) => {
                    const fullPath = `${wasmBase}${path}`;
                    console.log('Worker: locateFile requesting:', path, '->', fullPath);
                    return fullPath;
                },
                print: (text) => console.log('WASM stdout:', text),
                printErr: (text) => console.error('WASM stderr:', text)
            };

            // Initialize module with config
            // With MODULARIZE=1, Module is a factory function that takes the config
            wasmModule = await Module(config);
            arenaWrapper = new wasmModule.ArenaWrapper();
            
            self.postMessage({ type: 'INIT_COMPLETE' });
        } catch (error) {
            self.postMessage({ 
                type: 'INIT_ERROR', 
                error: error.message 
            });
        }
    }
    
    else if (type === 'RUN_MATCHUP') {
        try {
            if (!arenaWrapper) {
                throw new Error('Worker not initialized');
            }
            
            const { matchupId, bot1, bot2, bot1Index, bot2Index, gamesPerMatchup } = data;
            
            let allResults = [];
            
            // Run games one at a time to get results immediately
            for (let gameNum = 0; gameNum < gamesPerMatchup; gameNum++) {
                const startingPlayer = gameNum % 2;
                
                // Run single game (gamesPerMatchup = 1)
                const resultJSON = arenaWrapper.runSingleMatchup(
                    bot1,
                    bot2,
                    bot1Index,
                    bot2Index,
                    1  // Run just 1 game
                );
                
                const result = JSON.parse(resultJSON);
                const gameResult = result.results[0]; // Get the single game result
                allResults.push(gameResult);
                
                // Send game complete with result immediately
                self.postMessage({
                    type: 'GAME_COMPLETE',
                    matchupId,
                    gameResult: gameResult
                });
            }
            
            // Send matchup complete
            self.postMessage({
                type: 'MATCHUP_COMPLETE',
                matchupId,
                results: allResults
            });
        } catch (error) {
            self.postMessage({
                type: 'MATCHUP_ERROR',
                matchupId: data.matchupId,
                error: error.message
            });
        }
    }
});
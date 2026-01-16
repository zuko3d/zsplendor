class ArenaWorkerPool {
    constructor(workerCount = 8) {
        this.workerCount = workerCount;
        this.workers = [];
        this.availableWorkers = [];
        this.busyWorkers = new Set();
        this.taskQueue = [];
        this.results = [];
        this.totalTasks = 0;
        this.completedTasks = 0;
        this.progressCallback = null;
        this.resolveComplete = null;
        this.rejectComplete = null;
        this.totalGames = 0;
        this.completedGames = 0;
    }
    
    async initialize() {
        // Use absolute path resolved relative to current page
        const wasmPath = new URL('wasm/splendor.js?v=3', window.location.href).href;
        
        for (let i = 0; i < this.workerCount; i++) {
            const worker = new Worker('js/arena_worker.js');
            
            // Wait for worker to initialize
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error(`Worker ${i} initialization timeout`));
                }, 30000); // 30 second timeout
                
                worker.addEventListener('message', function initHandler(e) {
                    if (e.data.type === 'INIT_COMPLETE') {
                        clearTimeout(timeout);
                        worker.removeEventListener('message', initHandler);
                        resolve();
                    } else if (e.data.type === 'INIT_ERROR') {
                        clearTimeout(timeout);
                        worker.removeEventListener('message', initHandler);
                        reject(new Error(e.data.error));
                    }
                });
                
                worker.addEventListener('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
                
                // Send init message
                worker.postMessage({
                    type: 'INIT',
                    data: { wasmPath }
                });
            });
            
            // Set up message handler for tasks
            worker.addEventListener('message', (e) => this.handleWorkerMessage(i, e));
            worker.addEventListener('error', (error) => this.handleWorkerError(i, error));
            
            this.workers.push(worker);
            this.availableWorkers.push(i);
        }
    }
    
    handleWorkerMessage(workerIndex, e) {
        const { type, matchupId, results, error, gameResult } = e.data;
        
        if (type === 'GAME_COMPLETE') {
            // Individual game completed - increment global counter and pass result
            this.completedGames++;
            if (this.progressCallback) {
                // Pass game result for immediate stats update
                this.progressCallback(this.completedGames, this.totalGames, gameResult);
            }
        }
        else if (type === 'MATCHUP_COMPLETE') {
            this.results.push({ matchupId, results });
            this.completedTasks++;
            
            // Mark worker as available
            this.busyWorkers.delete(workerIndex);
            this.availableWorkers.push(workerIndex);
            
            // Process next task or complete
            this.processNextTask();
        } else if (type === 'MATCHUP_ERROR') {
            console.error(`Matchup ${matchupId} failed:`, error);
            this.completedTasks++;
            
            // Mark worker as available
            this.busyWorkers.delete(workerIndex);
            this.availableWorkers.push(workerIndex);
            
            // Continue with next task
            this.processNextTask();
        }
    }
    
    handleWorkerError(workerIndex, error) {
        console.error(`Worker ${workerIndex} error:`, error);
        // Worker might be in bad state, but continue
        if (this.busyWorkers.has(workerIndex)) {
            this.busyWorkers.delete(workerIndex);
            this.availableWorkers.push(workerIndex);
            this.completedTasks++;
            this.processNextTask();
        }
    }
    
    processNextTask() {
        // Check if we're done
        if (this.completedTasks >= this.totalTasks) {
            if (this.resolveComplete) {
                const resolve = this.resolveComplete;
                this.resolveComplete = null;
                this.rejectComplete = null;
                resolve(this.results);
            }
            return;
        }
        
        // Process next task if available
        if (this.taskQueue.length > 0 && this.availableWorkers.length > 0) {
            const task = this.taskQueue.shift();
            const workerIndex = this.availableWorkers.shift();
            
            this.busyWorkers.add(workerIndex);
            this.workers[workerIndex].postMessage({
                type: 'RUN_MATCHUP',
                data: task
            });
        }
    }
    
    async runTasks(tasks, progressCallback) {
        this.taskQueue = [...tasks];
        this.totalTasks = tasks.length;
        this.completedTasks = 0;
        this.results = [];
        this.progressCallback = progressCallback;
        
        // Calculate total games across all tasks
        this.totalGames = tasks.reduce((sum, task) => sum + task.gamesPerMatchup, 0);
        this.completedGames = 0;
        
        return new Promise((resolve, reject) => {
            this.resolveComplete = resolve;
            this.rejectComplete = reject;
            
            // Start processing tasks
            const initialBatch = Math.min(this.workerCount, this.taskQueue.length);
            
            if (initialBatch === 0 && this.totalTasks === 0) {
                this.resolveComplete(this.results);
                return;
            }

            for (let i = 0; i < initialBatch; i++) {
                this.processNextTask();
            }
        });
    }
    
    terminate() {
        this.workers.forEach(worker => worker.terminate());
        this.workers = [];
        this.availableWorkers = [];
        this.busyWorkers.clear();
    }
}
/**
 * AIWorkerProxy - Main thread interface to AI Web Worker
 * Provides async API for AI action computation without blocking UI
 */
class AIWorkerProxy {
    constructor(workerPath = 'js/ai_worker.js') {
        // Add cache-busting parameter to worker URL
        this.workerPath = workerPath + '?v=4';
        this.worker = null;
        this.isReady = false;
        this.pendingRequests = new Map();
        this.requestIdCounter = 0;
        this.progressCallback = null;
        this.useWorker = typeof Worker !== 'undefined';
        this.difficulty = 5000000; // Default difficulty
        this.timeLimit = 2.5; // Default time limit in seconds
        this.debugMode = false; // Debug mode flag
        
        // Fallback: Main thread AI interface (if workers not available)
        this.fallbackWasm = null;
    }
    
    /**
     * Initialize the worker and load WASM module
     * @param {string} wasmPath - Path to AI WASM module
     * @returns {Promise<void>}
     */
    async initialize(wasmPath = 'wasm/splendor.js') {
        if (!this.useWorker) {
            console.warn('Web Workers not supported, using main thread AI');
            return this.initializeFallback(wasmPath);
        }
        
        try {
            // Create worker
            this.worker = new Worker(this.workerPath);
            
            // Set up message handler
            this.worker.onmessage = (event) => this.handleMessage(event);
            
            // Set up error handler
            this.worker.onerror = (error) => this.handleError(error);
            
            // Initialize worker with WASM path
            const initPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Worker initialization timeout'));
                }, 10000);
                
                const handler = (event) => {
                    if (event.data.type === 'READY') {
                        clearTimeout(timeout);
                        this.isReady = true;
                        resolve();
                    } else if (event.data.type === 'ERROR') {
                        clearTimeout(timeout);
                        reject(new Error(event.data.error));
                    }
                };
                
                this.worker.addEventListener('message', handler, { once: true });
            });
            
            this.worker.postMessage({
                type: 'INIT',
                wasmPath: wasmPath
            });
            
            await initPromise;
            console.log('AI Worker initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize AI Worker:', error);
            console.warn('Falling back to main thread AI');
            this.useWorker = false;
            await this.initializeFallback(wasmPath);
        }
    }
    
    /**
     * Initialize fallback (main thread) AI
     */
    async initializeFallback(wasmPath) {
        // Load WASM module on main thread
        if (typeof Module === 'undefined') {
            throw new Error('WASM Module not available');
        }
        // We assume Module is already loaded or available globally if we are falling back
        // But usually WasmInterface loads it. 
        // If we are here, it means we need to access the module.
        // Let's assume WasmInterface has loaded it or we can get it.
        // Ideally, we should reuse the module from WasmInterface if possible, 
        // but here we might need to wait for it.
        
        // For simplicity in fallback, we'll assume Module() is available globally 
        // as it is loaded by the script tag in index.html usually, 
        // or we can wait for it.
        
        const module = await Module();
        this.fallbackWasm = {
            module: module,
            aiEngine: new module.AIEngine(module.AIDifficulty.HARD)
        };
        this.isReady = true;
    }
    
    /**
     * Request AI action computation
     * @param {Object} gameState - Current game state
     * @param {number} playerId - AI player ID
     * @returns {Promise<Object>} - Selected action
     */
    async getAIAction(gameState, playerId) {
        if (!this.isReady) {
            throw new Error('AI Worker not initialized');
        }
        
        // Use fallback if worker not available
        if (!this.useWorker) {
            return this.getAIActionFallback(gameState, playerId);
        }
        
        // Generate unique request ID
        const requestId = `ai_request_${this.requestIdCounter++}`;
        
        // Create promise for this request
        const promise = new Promise((resolve, reject) => {
            // Set timeout (30 seconds)
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error('AI computation timeout'));
            }, 30000);
            
            // Store request
            this.pendingRequests.set(requestId, {
                resolve,
                reject,
                timeout
            });
        });
        
        // Send request to worker
        this.worker.postMessage({
            type: 'COMPUTE_AI_ACTION',
            id: requestId,
            gameState: gameState,
            playerId: playerId,
            difficulty: this.difficulty,
            timeLimit: this.timeLimit
        });
        
        return promise;
    }
    
    /**
     * Fallback: Compute AI action on main thread
     */
    getAIActionFallback(gameState, playerId) {
        return new Promise((resolve) => {
            // Use setTimeout to yield to event loop
            setTimeout(() => {
                // This will still block, but at least UI gets one frame
                const stateJSON = JSON.stringify(gameState);
                // We need to use the selectActionForEngine method if we have the wrapper,
                // but here we are using the raw engine binding if possible.
                // Wait, the binding exposes selectActionForEngine which takes a GameWrapper.
                // But we also have selectActionJSON in the binding?
                // Let's check wasm_bindings.cpp.
                // It has selectActionForEngine. It does NOT have selectActionJSON currently.
                // We need to update wasm_bindings.cpp to support JSON or use the wrapper.
                // Since we are refactoring, let's stick to the plan.
                // The plan assumed selectActionJSON exists. 
                // I should probably update wasm_bindings.cpp to include selectActionJSON 
                // to make passing state easier across worker boundary.
                
                // However, for fallback, we might need to reconstruct the GameWrapper?
                // Or just use the existing WasmInterface instance if we can access it.
                
                // Actually, let's look at how WasmInterface does it currently:
                // this.aiEngine.selectActionForEngine(this.gameEngine);
                
                // If we are in fallback mode, we probably want to do something similar 
                // but we don't have easy access to the gameEngine instance here.
                // So adding selectActionJSON to bindings is the best way forward for both Worker and Fallback.
                
                // For now, let's assume we will add selectActionJSON to bindings.
                // Use debug version if debug mode is enabled
                const actionJSON = this.debugMode ?
                    this.fallbackWasm.aiEngine.selectActionJSONDebug(stateJSON, playerId) :
                    this.fallbackWasm.aiEngine.selectActionJSON(stateJSON, playerId);
                const action = JSON.parse(actionJSON);
                resolve(action);
            }, 10);
        });
    }
    
    /**
     * Handle messages from worker
     */
    handleMessage(event) {
        const message = event.data;
        
        switch (message.type) {
            case 'AI_ACTION_RESULT':
                this.handleActionResult(message);
                break;
                
            case 'AI_ERROR':
                this.handleActionError(message);
                break;
                
            case 'PROGRESS':
                this.handleProgress(message);
                break;
                
            case 'READY':
                // Handled by initialization promise, but might arrive late or be duplicate
                break;

            default:
                console.warn('Unknown message type from worker:', message.type);
        }
    }
    
    /**
     * Handle successful action result
     */
    handleActionResult(message) {
        const request = this.pendingRequests.get(message.id);
        if (request) {
            clearTimeout(request.timeout);
            this.pendingRequests.delete(message.id);
            request.resolve(message.action);
            
            // Log stats if available
            if (message.stats) {
                console.log(`AI computation: ${message.stats.iterations} iterations in ${message.stats.timeMs}ms`);
            }
        }
    }
    
    /**
     * Handle error from worker
     */
    handleActionError(message) {
        const request = this.pendingRequests.get(message.id);
        if (request) {
            clearTimeout(request.timeout);
            this.pendingRequests.delete(message.id);
            request.reject(new Error(message.error));
        }
    }
    
    /**
     * Handle progress update
     */
    handleProgress(message) {
        if (this.progressCallback) {
            this.progressCallback(message.progress);
        }
    }
    
    /**
     * Handle worker error
     */
    handleError(error) {
        console.error('Worker error:', error);
        
        // Reject all pending requests
        for (const [id, request] of this.pendingRequests) {
            clearTimeout(request.timeout);
            request.reject(new Error('Worker crashed'));
        }
        this.pendingRequests.clear();
        
        // Try to restart worker
        this.restart();
    }
    
    /**
     * Restart worker after crash
     */
    async restart() {
        console.log('Restarting AI Worker...');
        this.terminate();
        this.isReady = false;
        
        try {
            await this.initialize();
        } catch (error) {
            console.error('Failed to restart worker:', error);
            this.useWorker = false;
        }
    }
    
    /**
     * Set AI difficulty
     * @param {number} difficulty - MCTS iterations (100, 1000, 50000)
     */
    setDifficulty(difficulty) {
        this.difficulty = difficulty;
        
        if (this.useWorker && this.worker) {
            this.worker.postMessage({
                type: 'SET_DIFFICULTY',
                difficulty: difficulty
            });
        } else if (this.fallbackWasm) {
            let diffEnum;
            if (difficulty <= 100) diffEnum = this.fallbackWasm.module.AIDifficulty.EASY;
            else if (difficulty <= 1000) diffEnum = this.fallbackWasm.module.AIDifficulty.MEDIUM;
            else diffEnum = this.fallbackWasm.module.AIDifficulty.HARD;
            
            this.fallbackWasm.aiEngine.setDifficulty(diffEnum);
        }
    }
    
    /**
     * Set AI time limit
     * @param {number} timeLimit - Time limit in seconds
     */
    setTimeLimit(timeLimit) {
        this.timeLimit = timeLimit;
        
        if (this.useWorker && this.worker) {
            this.worker.postMessage({
                type: 'SET_TIME_LIMIT',
                timeLimit: timeLimit
            });
        }
        // Note: Fallback mode doesn't support time limits currently
    }
    
    /**
     * Set debug mode for AI
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        if (this.useWorker && this.worker) {
            this.worker.postMessage({
                type: 'SET_DEBUG_MODE',
                enabled: enabled
            });
        } else if (this.fallbackWasm) {
            this.fallbackWasm.aiEngine.setDebugMode(enabled);
        }
    }
    
    /**
     * Set progress callback
     * @param {Function} callback - Called with progress (0-100)
     */
    onProgress(callback) {
        this.progressCallback = callback;
    }
    
    /**
     * Check if worker is available
     */
    isAvailable() {
        return this.useWorker && this.isReady;
    }
    
    /**
     * Terminate worker
     */
    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.isReady = false;
        this.pendingRequests.clear();
    }
}
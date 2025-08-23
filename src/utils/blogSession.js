"use strict";
// © 2025 Mark Hustad — MIT License
// Blog documentation session management
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupSession = exports.getSessionStatus = exports.cancelSession = exports.completeSession = exports.createSession = exports.getActiveSession = void 0;
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
const SESSION_FILE = '.blog-session.json';
// Get the current active session
const getActiveSession = () => {
    try {
        if (!fs.existsSync(SESSION_FILE)) {
            return null;
        }
        const sessionData = fs.readFileSync(SESSION_FILE, 'utf8');
        const session = JSON.parse(sessionData);
        return session.status === 'active' ? session : null;
    }
    catch (error) {
        console.warn('[BlogSession] Error reading session file:', error);
        return null;
    }
};
exports.getActiveSession = getActiveSession;
// Create a new documentation session
const createSession = (featureName, description, tags) => {
    // Check if there's already an active session
    const existingSession = (0, exports.getActiveSession)();
    if (existingSession) {
        throw new Error(`Active session already exists: "${existingSession.featureName}". Complete or cancel it first.`);
    }
    const session = {
        id: generateSessionId(),
        featureName,
        startBranch: getCurrentBranch(),
        startCommit: getCurrentCommit(),
        createdAt: new Date().toISOString(),
        status: 'active',
        description,
        tags
    };
    saveSession(session);
    console.log(`[BlogSession] ✅ Started documentation session: "${featureName}"`);
    console.log(`[BlogSession] Branch: ${session.startBranch}`);
    console.log(`[BlogSession] Starting commit: ${session.startCommit}`);
    return session;
};
exports.createSession = createSession;
// Complete the current session
const completeSession = () => {
    const session = (0, exports.getActiveSession)();
    if (!session) {
        throw new Error('No active documentation session found. Start one with blog:start first.');
    }
    session.status = 'completed';
    saveSession(session);
    console.log(`[BlogSession] ✅ Completed documentation session: "${session.featureName}"`);
    return session;
};
exports.completeSession = completeSession;
// Cancel the current session
const cancelSession = () => {
    const session = (0, exports.getActiveSession)();
    if (!session) {
        throw new Error('No active documentation session found.');
    }
    session.status = 'cancelled';
    saveSession(session);
    console.log(`[BlogSession] ❌ Cancelled documentation session: "${session.featureName}"`);
};
exports.cancelSession = cancelSession;
// Get session status info
const getSessionStatus = () => {
    const session = (0, exports.getActiveSession)();
    return {
        hasActiveSession: session !== null,
        session: session || undefined
    };
};
exports.getSessionStatus = getSessionStatus;
// Helper functions
const saveSession = (session) => {
    try {
        fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
    }
    catch (error) {
        console.error('[BlogSession] Error saving session:', error);
        throw new Error('Failed to save session data');
    }
};
const generateSessionId = () => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
const getCurrentBranch = () => {
    try {
        return (0, child_process_1.execSync)('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    }
    catch (error) {
        console.warn('[BlogSession] Could not get current branch:', error);
        return 'unknown';
    }
};
const getCurrentCommit = () => {
    try {
        return (0, child_process_1.execSync)('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    }
    catch (error) {
        console.warn('[BlogSession] Could not get current commit:', error);
        return 'unknown';
    }
};
// Clean up session file (for completed/cancelled sessions)
const cleanupSession = () => {
    try {
        if (fs.existsSync(SESSION_FILE)) {
            fs.unlinkSync(SESSION_FILE);
            console.log('[BlogSession] Session file cleaned up');
        }
    }
    catch (error) {
        console.warn('[BlogSession] Error cleaning up session file:', error);
    }
};
exports.cleanupSession = cleanupSession;

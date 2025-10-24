// 游戏配置
const GAME_CONFIG = {
    rows: 31,
    cols: 31,
    difficulties: {
        easy: { cakes: 181, flagUses: 2 },
        medium: { cakes: 254, flagUses: 3 },
        hard: { cakes: 331, flagUses: 4 }
    }
};

// 游戏状态
let gameState = {
    board: [],
    cakesLeft: 0,
    score: 0,
    time: 0,
    difficulty: 'easy',
    isPlaying: false,
    isFirstClick: true,
    timerInterval: null,
    gameBoardElement: null,
    minesLeftElement: null, // 保持原有ID兼容
    scoreElement: null,
    timerElement: null,
    difficultySelector: null,
    flagToolButton: null,
    flagUsesLeft: 0,
    changeDifficultyButton: null,
    gameOverModal: null,
    difficultyModal: null,
    confirmDifficultyButton: null,
    modalTitleElement: null,
    finalScoreElement: null,
    finalTimeElement: null,
    playAgainButton: null
};

// 初始化游戏
function initGame() {
    // 获取DOM元素
    gameState.gameBoardElement = document.getElementById('game-board');
    gameState.minesLeftElement = document.getElementById('mines-left');
    gameState.scoreElement = document.getElementById('score');
    gameState.timerElement = document.getElementById('timer');
    gameState.difficultySelector = document.getElementById('difficulty-selector');
    gameState.flagToolButton = document.getElementById('flag-tool');
    gameState.changeDifficultyButton = document.getElementById('change-difficulty-btn');
    gameState.gameOverModal = document.getElementById('game-over-modal');
    gameState.difficultyModal = document.getElementById('difficulty-modal');
    gameState.confirmDifficultyButton = document.getElementById('confirm-difficulty-btn');
    gameState.modalTitleElement = document.getElementById('modal-title');
    gameState.finalScoreElement = document.getElementById('final-score');
    gameState.finalTimeElement = document.getElementById('final-time');
    gameState.playAgainButton = document.getElementById('play-again-btn');
    
    // 添加事件监听器
    gameState.changeDifficultyButton.addEventListener('click', showDifficultyModal);
    gameState.confirmDifficultyButton.addEventListener('click', startGame);
    gameState.flagToolButton.addEventListener('click', useFlagTool);
    gameState.playAgainButton.addEventListener('click', playAgain);
    
    // 初始化工具按钮状态
    resetTools();
    
    // 显示难度选择模态框
    showDifficultyModal();
}

// 显示难度选择模态框
function showDifficultyModal() {
    // 如果游戏正在进行中，显示确认提示
    if (gameState.isPlaying && !gameState.isFirstClick) {
        if (confirm('这么简单的关卡都没过，确认要选择其他难度受虐吗？')) {
            stopGame();
            gameState.difficultyModal.style.display = 'flex';
        }
    } else {
        gameState.difficultyModal.style.display = 'flex';
    }
}

// 关闭难度选择模态框
function closeDifficultyModal() {
    gameState.difficultyModal.style.display = 'none';
}

// 重置工具状态
function resetTools() {
    // 设置寻宝工具
    const difficulty = gameState.difficulty || 'easy';
    gameState.flagUsesLeft = GAME_CONFIG.difficulties[difficulty].flagUses;
    gameState.flagToolButton.disabled = true;
    gameState.flagToolButton.textContent = `寻宝 (${gameState.flagUsesLeft})`;
}

// 创建游戏板
function createGameBoard() {
    // 清空游戏板
    gameState.board = [];
    gameState.gameBoardElement.innerHTML = '';
    
    // 设置游戏板尺寸和样式
    gameState.gameBoardElement.style.gridTemplateColumns = `repeat(${GAME_CONFIG.cols}, 1fr)`;
    gameState.gameBoardElement.style.gridTemplateRows = `repeat(${GAME_CONFIG.rows}, 1fr)`;
    
    // 确保游戏板在容器内居中
    gameState.gameBoardElement.style.margin = '0 auto';
    
    // 创建空的游戏板
    for (let row = 0; row < GAME_CONFIG.rows; row++) {
        gameState.board[row] = [];
        for (let col = 0; col < GAME_CONFIG.cols; col++) {
            gameState.board[row][col] = {
                isMine: false,
                isRevealed: false,
                isFlagged: false,
                neighborMines: 0,
                row,
                col
            };
            
            // 创建DOM元素
            const cellElement = document.createElement('div');
            cellElement.classList.add('cell');
            cellElement.dataset.row = row;
            cellElement.dataset.col = col;
            

            
            // 添加点击事件和触摸事件支持
            // 鼠标点击事件
            cellElement.addEventListener('click', () => handleCellClick(row, col));
            cellElement.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                handleCellRightClick(row, col);
            });
            
            // 移动设备触摸事件
            let longPressTimer;
            const longPressDuration = 500; // 长按时间阈值（毫秒）
            
            // 触摸开始事件
            cellElement.addEventListener('touchstart', (e) => {
                e.preventDefault(); // 防止触发鼠标事件
                // 开始长按计时器
                longPressTimer = setTimeout(() => {
                    handleCellRightClick(row, col); // 长按模拟右键点击（标记地雷）
                }, longPressDuration);
            });
            
            // 触摸移动事件 - 如果用户移动手指，则取消长按
            cellElement.addEventListener('touchmove', () => {
                clearTimeout(longPressTimer);
            });
            
            // 触摸结束事件 - 如果不是长按，则执行单击操作
            cellElement.addEventListener('touchend', () => {
                clearTimeout(longPressTimer);
                // 短点击模拟左键点击（揭示格子）
                handleCellClick(row, col);
            });
            
            // 触摸取消事件（如电话打断）
            cellElement.addEventListener('touchcancel', () => {
                clearTimeout(longPressTimer);
            });
            
            // 将单元格添加到游戏板容器中
            gameState.gameBoardElement.appendChild(cellElement);
        }
    }
    
    // 确保所有格子都在容器内
    gameState.gameBoardElement.parentElement.style.overflow = 'hidden';
}

// 放置蛋糕
function placeMines(firstRow, firstCol) {
    const difficulty = gameState.difficulty;
    const cakesCount = GAME_CONFIG.difficulties[difficulty].cakes;
    gameState.cakesLeft = cakesCount;
    gameState.minesLeftElement.textContent = gameState.cakesLeft;
    
    let cakesPlaced = 0;
    
    // 确保首次点击的位置及其周围没有蛋糕
    const safeZone = new Set();
    for (let r = Math.max(0, firstRow - 1); r <= Math.min(GAME_CONFIG.rows - 1, firstRow + 1); r++) {
        for (let c = Math.max(0, firstCol - 1); c <= Math.min(GAME_CONFIG.cols - 1, firstCol + 1); c++) {
            safeZone.add(`${r}-${c}`);
        }
    }
    
    // 随机放置蛋糕
    while (cakesPlaced < cakesCount) {
        const row = Math.floor(Math.random() * GAME_CONFIG.rows);
        const col = Math.floor(Math.random() * GAME_CONFIG.cols);
        const key = `${row}-${col}`;
        
        if (!gameState.board[row][col].isMine && !safeZone.has(key)) {
            gameState.board[row][col].isMine = true; // 保持isMine属性以减少修改
            cakesPlaced++;
        }
    }
    
    // 计算每个格子周围的蛋糕数
    calculateNeighborMines();
}

// 计算每个格子周围的蛋糕数
function calculateNeighborMines() {
    for (let row = 0; row < GAME_CONFIG.rows; row++) {
        for (let col = 0; col < GAME_CONFIG.cols; col++) {
            if (!gameState.board[row][col].isMine) {
                let count = 0;
                
                // 检查周围8个格子
                for (let r = Math.max(0, row - 1); r <= Math.min(GAME_CONFIG.rows - 1, row + 1); r++) {
                    for (let c = Math.max(0, col - 1); c <= Math.min(GAME_CONFIG.cols - 1, col + 1); c++) {
                        if (r !== row || c !== col) {
                            if (gameState.board[r][c].isMine) { // 保持isMine属性以减少修改
                                count++;
                            }
                        }
                    }
                }
                
                gameState.board[row][col].neighborMines = count;
            }
        }
    }
}

// 处理格子左键点击
function handleCellClick(row, col) {
    if (!gameState.isPlaying) return;
    
    const cell = gameState.board[row][col];
    
    // 如果格子已经被揭示或标记，则忽略
    if (cell.isRevealed || cell.isFlagged) return;
    
    // 首次点击时放置蛋糕
    if (gameState.isFirstClick) {
        gameState.isFirstClick = false;
        placeMines(row, col);
        startTimer();
        // 启用工具按钮
        gameState.flagToolButton.disabled = false;
    }
    
    // 揭示格子
    revealCell(row, col);
    
    // 检查游戏是否结束
    checkGameState();
}

// 处理格子右键点击（标记地雷）
function handleCellRightClick(row, col) {
    if (!gameState.isPlaying || gameState.isFirstClick) return;
    
    const cell = gameState.board[row][col];
    
    // 如果格子已经被揭示，则忽略
    if (cell.isRevealed) return;
    
    // 切换标记状态
    cell.isFlagged = !cell.isFlagged;
    
    // 更新显示
    updateCellDisplay(row, col);
    
    // 更新剩余蛋糕数
    gameState.cakesLeft += cell.isFlagged ? -1 : 1;
    gameState.minesLeftElement.textContent = gameState.cakesLeft;
    
    // 检查游戏是否结束
    checkGameState();
}

// 揭示格子
function revealCell(row, col) {
    const cell = gameState.board[row][col];
    
    if (cell.isRevealed || cell.isFlagged) return;
    
    cell.isRevealed = true;
    updateCellDisplay(row, col);
    
    // 如果是地雷，游戏结束
    if (cell.isMine) {
        gameOver(false);
        return;
    }
    
    // 增加分数
    gameState.score += 10;
    gameState.scoreElement.textContent = gameState.score;
    
    // 如果是空白格子（周围没有地雷），递归揭示周围的格子
    if (cell.neighborMines === 0) {
        for (let r = Math.max(0, row - 1); r <= Math.min(GAME_CONFIG.rows - 1, row + 1); r++) {
            for (let c = Math.max(0, col - 1); c <= Math.min(GAME_CONFIG.cols - 1, col + 1); c++) {
                if (r !== row || c !== col) {
                    revealCell(r, c);
                }
            }
        }
    }
}

// 更新格子显示
function updateCellDisplay(row, col) {
    const cell = gameState.board[row][col];
    const cellElement = getCellElement(row, col);
    
    if (!cellElement) return;
    
    // 清除所有类和内容
    cellElement.className = 'cell';
    cellElement.innerHTML = ''; // 清除之前的内容，包括可能的图片
    
    if (cell.isRevealed) {
        cellElement.classList.add('revealed');
        
        if (cell.isMine) {
            cellElement.classList.add('cake');
            // 创建图片元素来显示炸弹图片
            const img = document.createElement('img');
            img.src = 'images/09b79885cedf7981014200eca8ef9146.jpg';
            img.alt = '炸弹';
            img.style.width = '100%';
            img.style.height = '100%';
            cellElement.appendChild(img);
        } else if (cell.neighborMines > 0) {
            cellElement.classList.add(`number-${cell.neighborMines}`);
            cellElement.textContent = cell.neighborMines;
        }
    } else if (cell.isFlagged) {
        cellElement.classList.add('flagged');
        cellElement.textContent = '🎯';
    }
}

// 获取格子DOM元素
function getCellElement(row, col) {
    return document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
}

// 使用寻宝工具
function useFlagTool() {
    if (!gameState.isPlaying || gameState.flagToolButton.disabled || gameState.flagUsesLeft <= 0) return;
    
    // 查找未揭示且为蛋糕的格子
    const cakeCells = [];
    for (let row = 0; row < GAME_CONFIG.rows; row++) {
        for (let col = 0; col < GAME_CONFIG.cols; col++) {
            const cell = gameState.board[row][col];
            if (!cell.isRevealed && cell.isMine && !cell.isFlagged) { // 保持isMine属性以减少修改
                cakeCells.push(cell);
            }
        }
    }
    
    if (cakeCells.length > 0) {
        // 随机选择一个蛋糕格子
        const cakeCell = cakeCells[Math.floor(Math.random() * cakeCells.length)];
        
        // 自动标记蛋糕
        handleCellRightClick(cakeCell.row, cakeCell.col);
        
        // 减少使用次数
        gameState.flagUsesLeft--;
        gameState.flagToolButton.textContent = `寻宝 (${gameState.flagUsesLeft})`;
        
        // 如果没有剩余次数，禁用按钮
        if (gameState.flagUsesLeft <= 0) {
            gameState.flagToolButton.disabled = true;
        }
    }
}

// 检查游戏状态
function checkGameState() {
    // 检查是否所有非地雷格子都被揭示
    let revealedCount = 0;
    let totalNonCakes = GAME_CONFIG.rows * GAME_CONFIG.cols - 
                        GAME_CONFIG.difficulties[gameState.difficultySelector.value].cakes;
    
    for (let row = 0; row < GAME_CONFIG.rows; row++) {
        for (let col = 0; col < GAME_CONFIG.cols; col++) {
            const cell = gameState.board[row][col];
            if (!cell.isMine && cell.isRevealed) {
                revealedCount++;
            }
        }
    }
    
    if (revealedCount === totalNonCakes) {
        // 游戏胜利
        gameOver(true);
    }
}

// 游戏结束
function gameOver(isWin) {
    gameState.isPlaying = false;
    stopTimer();
    
    // 显示所有蛋糕
    for (let row = 0; row < GAME_CONFIG.rows; row++) {
        for (let col = 0; col < GAME_CONFIG.cols; col++) {
            const cell = gameState.board[row][col];
            if (cell.isMine && !cell.isFlagged) {
                cell.isRevealed = true;
                updateCellDisplay(row, col);
            } else if (!cell.isMine && cell.isFlagged) {
                // 标记错误的格子
                const cellElement = getCellElement(row, col);
                cellElement.classList.add('revealed', 'wrong');
                cellElement.textContent = '❌';
            }
        }
    }
    
    // 如果胜利，给所有正确标记的蛋糕加分
    if (isWin) {
        let correctFlags = 0;
        for (let row = 0; row < GAME_CONFIG.rows; row++) {
            for (let col = 0; col < GAME_CONFIG.cols; col++) {
                const cell = gameState.board[row][col];
                if (cell.isMine && cell.isFlagged) {
                    correctFlags++;
                }
            }
        }
        
        // 额外奖励分数：剩余时间 * 10 + 正确标记的蛋糕 * 20
        const bonusScore = gameState.time * 10 + correctFlags * 20;
        gameState.score += bonusScore;
        gameState.scoreElement.textContent = gameState.score;
    }
    
    // 更新游戏结束模态框
    gameState.modalTitleElement.textContent = isWin ? '恭喜胜利！' : '游戏结束！';
    gameState.finalScoreElement.textContent = gameState.score;
    gameState.finalTimeElement.textContent = gameState.time;
    
    // 显示游戏结束模态框
    gameState.gameOverModal.style.display = 'flex';
    
    // 禁用工具按钮
    gameState.flagToolButton.disabled = true;
}

// 开始游戏
function startGame() {
    // 获取选择的难度
    gameState.difficulty = gameState.difficultySelector.value;
    
    // 重置游戏状态
    gameState.score = 0;
    gameState.time = 0;
    gameState.cakesLeft = 0;
    gameState.isPlaying = true;
    gameState.isFirstClick = true;
    
    // 更新UI
    gameState.scoreElement.textContent = gameState.score;
    gameState.timerElement.textContent = gameState.time;
    gameState.minesLeftElement.textContent = gameState.minesLeft;
    
    // 创建游戏板
    createGameBoard();
    
    // 重置工具状态
    resetTools();
    
    // 停止之前的计时器
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
    
    // 自动为玩家揭示一个安全格子
    autoRevealFirstCell();
    
    // 关闭难度选择模态框
    closeDifficultyModal();
}

// 自动揭示第一个安全格子
function autoRevealFirstCell() {
    // 随机选择一个中心附近的格子作为第一个安全格子
    const centerRow = Math.floor(GAME_CONFIG.rows / 2);
    const centerCol = Math.floor(GAME_CONFIG.cols / 2);
    const radius = Math.min(5, Math.floor(GAME_CONFIG.rows / 4), Math.floor(GAME_CONFIG.cols / 4));
    
    let startRow, startCol;
    // 在中心区域随机选择一个位置
    startRow = centerRow + Math.floor(Math.random() * (radius * 2 + 1)) - radius;
    startCol = centerCol + Math.floor(Math.random() * (radius * 2 + 1)) - radius;
    
    // 确保在有效范围内
    startRow = Math.max(0, Math.min(GAME_CONFIG.rows - 1, startRow));
    startCol = Math.max(0, Math.min(GAME_CONFIG.cols - 1, startCol));
    
    // 处理首次点击
    handleCellClick(startRow, startCol);
}

// 停止游戏
function stopGame() {
    gameState.isPlaying = false;
    
    // 停止计时器
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
    
    // 禁用工具按钮
    gameState.flagToolButton.disabled = true;
}

// 再玩一次
function playAgain() {
    gameState.gameOverModal.style.display = 'none';
    startGame();
}

// 启动计时器
function startTimer() {
    gameState.timerInterval = setInterval(() => {
        gameState.time++;
        gameState.timerElement.textContent = gameState.time;
    }, 1000);
}

// 停止计时器
function stopTimer() {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
}

// 添加提示格子的样式
const style = document.createElement('style');
style.textContent = `
    .cell.hint {
        animation: pulse 1s infinite;
    }
    
    @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.7; }
        100% { opacity: 1; }
    }
    
    .cell.wrong {
        background-color: #ffcccc;
        color: #ff0000;
    }
`;
document.head.appendChild(style);

// 页面加载完成后初始化游戏
window.addEventListener('DOMContentLoaded', initGame);
const API_BASE = window.location.origin + '/';
const WS_BASE = window.location.origin.replace(/^http/, 'ws')+"/ws";

let currentMode = null; // 'cashier', 'kitchen', or 'admin'
let cart = [];
let fetchedMobileOrder = null; // To store the looked-up mobile order
let activeOrders = [];
let websocket = null;

const elements = {
    // Mode selection
    modeSelection: document.getElementById('mode-selection'),
    cashierMode: document.getElementById('cashier-mode'),
    kitchenMode: document.getElementById('kitchen-mode'),
    menusGrid: document.getElementById('menus-grid'),
    cartItems: document.getElementById('cart-items'),
    cartTotal: document.getElementById('cart-total'),
    orderSubmitBtn: document.getElementById('order-submit-btn'),
    orderSummary: document.getElementById('order-summary'),
    receivedAmount: document.getElementById('received-amount'),
    change: document.getElementById('change'),
    paymentArea: document.getElementById('payment-area'),
    historyList: document.getElementById('history-list'),

    // Mobile Order Lookup
    paymentNumberInput: document.getElementById('payment-number-input'),
    findOrderBtn: document.getElementById('find-order-btn'),
    mobileOrderDisplay: document.getElementById('mobile-order-display'),
    mobileOrderItems: document.getElementById('mobile-order-items'),
    mobileOrderTotal: document.getElementById('mobile-order-total'),
    mobileOrderStatus: document.getElementById('mobile-order-status'),
    mobileOrderPayBtn: document.getElementById('mobile-order-pay-btn'),

    activeOrders: document.getElementById('active-orders'),
    orderStatuses: document.getElementById('order-statuses'),
    cashierModeBtn: document.getElementById('cashier-mode-btn'),
    kitchenModeBtn: document.getElementById('kitchen-mode-btn'),
    adminModeBtn: document.getElementById('admin-mode-btn'),
    adminMode: document.getElementById('admin-mode'),
    salesData: document.getElementById('sales-data'),
    dailyTotal: document.getElementById('daily-total'),
    pastHourTotal: document.getElementById('past-hour-total'),
    past30minTotal: document.getElementById('past-30min-total'),
    adminOrdersList: document.getElementById('admin-orders-list'),
    menuSalesList: document.getElementById('menu-sales-list'),
    menuPriceList: document.getElementById('menu-price-list')
};

function showSection(mode) {
    try {
        currentMode = mode;
        if (elements.modeSelection) elements.modeSelection.classList.add('hidden');
        if (elements.cashierMode) elements.cashierMode.classList.add('hidden');
        if (elements.kitchenMode) elements.kitchenMode.classList.add('hidden');
        if (elements.adminMode) elements.adminMode.classList.add('hidden');

        if (mode === 'cashier' && elements.cashierMode) {
            elements.cashierMode.classList.remove('hidden');
            loadMenus();
            loadHistory();
        } else if (mode === 'kitchen' && elements.kitchenMode) {
            elements.kitchenMode.classList.remove('hidden');
            loadOrders();
        } else if (mode === 'admin' && elements.adminMode) {
            elements.adminMode.classList.remove('hidden');
            loadRealtimeSales();
            loadSalesByTime();
            loadAdminOrders();
            loadMenuPriceManagement();
        }
    } catch (error) {
        console.error(`セクション表示エラー (${mode}):`, error);
    }
}

elements.cashierModeBtn.onclick = () => {
    showSection('cashier');
};

elements.kitchenModeBtn.onclick = () => {
    showSection('kitchen');
};

elements.adminModeBtn.onclick = () => {
    showSection('admin');
};


async function fetchWithError(url, options = {}, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(API_BASE + url, options);
            if (!res.ok) {
                // サーバーからのエラーレスポンス(4xx, 5xx)はリトライしない
                if (res.status >= 400 && res.status < 600) {
                    throw new Error(`HTTP ${res.status}`);
                }
                // その他のエラー（ネットワーク障害など）はリトライの対象
                throw new Error('Network response was not ok');
            }
            return await res.json();
        } catch (error) {
            console.error(`Attempt ${i + 1} failed for ${url}:`, error.message);
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Exponential backoff
            } else {
                throw error; // Last attempt failed, re-throw.
            }
        }
    }
}

// メニューロード (全メニュー)
async function loadMenus() {
    try {
        const menus = await fetchWithError('api/menus/');
        elements.menusGrid.innerHTML = '';
        menus.forEach(menu => {
            const card = document.createElement('div');
            card.className = 'menu-card';
            card.innerHTML = `
                <h3>${menu.name}</h3>
                <p class="price">${menu.price}円</p>
                <button onclick="addToCart(${menu.id}, '${menu.name.replace(/'/g, "\\'")}', ${menu.price})">追加</button>
            `;
            elements.menusGrid.appendChild(card);
        });
    } catch (error) {
        console.error('メニュー取得エラー:', error);
    }
}

function addToCart(menuId, name, price) {
    const existing = cart.find(item => item.menuId === menuId);
    if (existing) {
        existing.quantity++;
    } else {
        cart.push({ menuId, name, price, quantity: 1 });
    }
    updateCart();
}

function updateCart() {
    try {
        if (!elements.cartItems || !elements.cartTotal || !elements.paymentArea || !elements.orderSubmitBtn) {
            console.error("カート関連のDOM要素が見つかりません。");
            return;
        }
        elements.cartItems.innerHTML = '';
        let total = 0;
        cart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;
            const div = document.createElement('div');
            div.className = 'cart-item';
            div.innerHTML = `
                <span class="cart-item-name">${item.name}</span>
                <div class="cart-item-controls">
                    <button onclick="decreaseCartItem(${item.menuId})">-</button>
                    <span>${item.quantity}</span>
                    <button onclick="increaseCartItem(${item.menuId})">+</button>
                </div>
                <span class="cart-item-price">${itemTotal}円</span>
            `;
            elements.cartItems.appendChild(div);
        });
        elements.cartTotal.textContent = `合計: ${total}円`;

        // カートが空になったら支払いエリアを隠す
        if (cart.length === 0) {
            elements.paymentArea.classList.add('hidden');
            elements.orderSubmitBtn.textContent = '注文送信';
        }
    } catch (error) {
        console.error("カート更新エラー:", error);
    }
}

function decreaseCartItem(menuId) {
    const existing = cart.find(item => item.menuId === menuId);
    if (existing) {
        existing.quantity--;
        if (existing.quantity <= 0) {
            cart = cart.filter(item => item.menuId !== menuId);
        }
    }
    updateCart();
}

function increaseCartItem(menuId) {
    const existing = cart.find(item => item.menuId === menuId);
    if (existing) {
        existing.quantity++;
    }
    updateCart();
}



elements.receivedAmount.oninput = calculateChange;

function calculateChange() {
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const received = parseFloat(elements.receivedAmount.value) || 0;
    const changeAmount = received - total;
    const displayAmount = changeAmount >= 0 ? changeAmount : 0;
    if (displayAmount > 0) {
        const denominations = [1000, 500, 100, 50, 10, 5, 1];
        let remaining = displayAmount;
        let combination = [];
        for (let denom of denominations) {
            let count = Math.floor(remaining / denom);
            if (count > 0) {
                combination.push(`${denom}円: ${count}枚`);
                remaining %= denom;
            }
        }
        const comboText = combination.join(', ');
        elements.change.innerHTML = `お釣り: ${displayAmount}円<br><small style="color: #666;">(${comboText})</small>`;
    } else {
        elements.change.textContent = `お釣り: ${displayAmount}円`;
    }
    if (changeAmount < 0) {
        elements.change.style.color = 'red';
    } else {
        elements.change.style.color = 'green';
    }
}

elements.orderSubmitBtn.onclick = async () => {
    // Determine if we are paying for a mobile order or a local cart order
    const isMobileOrderPayment = !!fetchedMobileOrder;
    const orderToPay = fetchedMobileOrder;
    const cartToPay = isMobileOrderPayment ? orderToPay.order_items.map(item => ({ ...item, menuId: item.menu.id, price: item.menu.price })) : cart;

    if (cartToPay.length === 0) {
        alert('支払い対象の注文がありません。');
        return;
    }

    const total = isMobileOrderPayment ? orderToPay.total_price : cartToPay.reduce((sum, item) => sum + item.price * item.quantity, 0);

    if (elements.paymentArea.classList.contains('hidden')) {
        // First click: Show payment area
        elements.paymentArea.classList.remove('hidden');
        elements.orderSummary.innerHTML = `<p>合計: ${total}円</p>`;
        elements.receivedAmount.value = total;
        calculateChange(total);
        elements.orderSubmitBtn.textContent = '支払い完了';
        
        setTimeout(() => {
            const cartSection = document.getElementById('cart-section');
            if (cartSection) cartSection.scrollTop = cartSection.scrollHeight;
        }, 100);

    } else {
        // Second click: Validate and submit
        const received = parseFloat(elements.receivedAmount.value) || 0;
        if (received < total) {
            alert('受け取り金額が不足しています。');
            return;
        }

        try {
            if (isMobileOrderPayment) {
                // Paying for a fetched mobile order: PATCH status
                await updateOrderStatus(orderToPay.id, 'pending');
                alert(`注文 ${orderToPay.id} の支払い完了。お釣り: ${received - total}円`);
                resetMobileOrderLookup();
            } else {
                // Paying for a local cart order: POST new order
                const response = await fetchWithError('api/orders/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        order_items: cart.map(item => ({ menu_id: item.menuId, quantity: item.quantity })),
                        total_price: total,
                        status: 'pending' // Direct payment, so status is pending
                    })
                });
                alert(`注文完了: ID ${response.id} お釣り: ${received - total}円`);
                cart = [];
                updateCart();
            }

            // Reset UI
            elements.paymentArea.classList.add('hidden');
            elements.orderSubmitBtn.textContent = '支払いへ進む';
            loadHistory();
            if (currentMode === 'kitchen') loadOrders();

        } catch (error) {
            console.error('支払い処理エラー:', error);
            alert('支払い処理中にエラーが発生しました。');
        }
    }
};

// --- Mobile Order Lookup Logic ---
elements.findOrderBtn.onclick = async () => {
    const paymentNumber = elements.paymentNumberInput.value.trim();
    if (!paymentNumber) {
        alert('支払い番号を入力してください。');
        return;
    }

    try {
        const order = await fetchWithError(`api/orders/by_payment_number/${paymentNumber}`);
        fetchedMobileOrder = order;
        displayFetchedOrder(order);
    } catch (error) {
        console.error('注文検索エラー:', error);
        alert('指定された支払い番号の注文は見つかりませんでした。');
        resetMobileOrderLookup();
    }
};

function displayFetchedOrder(order) {
    elements.mobileOrderDisplay.classList.remove('hidden');
    elements.mobileOrderItems.innerHTML = order.order_items.map(item =>
        `<div>${item.menu.name} x ${item.quantity}</div>`
    ).join('');
    elements.mobileOrderTotal.textContent = `合計: ${order.total_price}円`;

    const statusText = getStatusText(order.status);
    elements.mobileOrderStatus.innerHTML = `ステータス: <span class="status-${order.status}">${statusText}</span>`;

    if (order.status === 'unpaid') {
        elements.mobileOrderPayBtn.classList.remove('hidden');
    } else {
        elements.mobileOrderPayBtn.classList.add('hidden');
    }
}

function resetMobileOrderLookup() {
    fetchedMobileOrder = null;
    elements.paymentNumberInput.value = '';
    elements.mobileOrderDisplay.classList.add('hidden');
    elements.mobileOrderItems.innerHTML = '';
    elements.mobileOrderTotal.textContent = '';
    elements.mobileOrderStatus.innerHTML = '';
}

elements.mobileOrderPayBtn.onclick = () => {
    if (!fetchedMobileOrder) return;

    // Clear the local cart to avoid confusion
    cart = [];
    updateCart();

    // Use the main payment button's logic
    elements.orderSubmitBtn.click();
};
// 注文履歴ロード
async function loadHistory() {
    try {
        const orders = await fetchWithError('api/orders/');
        elements.historyList.innerHTML = orders.map(order => `
            <div class="history-item">
                <h4>注文 ${order.id} - ${order.created_at}</h4>
                <ul>${order.order_items.map(item => `<li>${item.menu?.name || '不明'} x${item.quantity}: ${item.quantity * (item.menu?.price || 0)}円</li>`).join('')}</ul>
                <p>合計: ${order.total_price}円 - ステータス: ${order.status}</p>
            </div>
        `).join('');
    } catch (error) {
        console.error('履歴取得エラー:', error);
    }
}

// 調理側: 注文ロード
async function loadOrders() {
    try {
        const orders = await fetchWithError('api/orders/');
        
        // 表示対象の注文をフィルタリング
        activeOrders = orders.filter(order => ['pending', 'preparing', 'ready', 'completed'].includes(order.status));
        const unpaidOrders = orders.filter(order => order.status === 'unpaid');

        elements.activeOrders.innerHTML = '';
        if (activeOrders.length === 0) {
            elements.activeOrders.innerHTML = '<p>調理対象の注文はありません。</p>';
        }
        
        // 注文をステータスとIDでソート
        activeOrders.sort((a, b) => {
            const statusOrder = { 'pending': 1, 'preparing': 2, 'ready': 3, 'completed': 4 };
            if (statusOrder[a.status] !== statusOrder[b.status]) {
                return statusOrder[a.status] - statusOrder[b.status];
            }
            return b.id - a.id; // 新しいものが上
        });
        
        activeOrders.forEach(order => {
            const div = document.createElement('div');
            div.className = `order-card status-${order.status}`; // ステータスに応じたクラスを追加
            div.innerHTML = `
                <h4>注文 ${order.id}</h4>
                <ul>${order.order_items.map(item => `<li>${item.menu?.name || '不明'} x${item.quantity}</li>`).join('')}</ul>
                <p>合計: ${order.total_price}円</p>
                <p>ステータス: <span class="status-text">${getStatusText(order.status)}</span></p>
                <div class="order-actions">
                    ${order.status === 'pending' ? `
                        <button onclick="updateOrderStatus(${order.id}, 'preparing')">調理開始</button>
                        <button class="cancel-btn" onclick="updateOrderStatus(${order.id}, 'cancelled', '本当にこの注文をキャンセルしますか？')">キャンセル</button>
                    ` : ''}
                    ${order.status === 'preparing' ? `<button onclick="updateOrderStatus(${order.id}, 'ready')">調理完了</button>` : ''}
                    ${order.status === 'ready' ? `<button onclick="updateOrderStatus(${order.id}, 'completed')">提供完了</button>` : ''}
                    ${order.status === 'completed' ? `<button class="revert-btn" onclick="updateOrderStatus(${order.id}, 'pending', 'この注文を受付済みに戻しますか？')">受付済みに戻す</button>` : ''}
                </div>
            `;
            elements.activeOrders.appendChild(div);
        });

        // 未払い注文の表示
        const unpaidList = document.getElementById('unpaid-orders-list');
        if (unpaidList) {
            unpaidList.innerHTML = '';
            if (unpaidOrders.length === 0) {
                unpaidList.innerHTML = '<p>未払いの注文はありません。</p>';
            } else {
                unpaidOrders.forEach(order => {
                    const div = document.createElement('div');
                    div.className = 'order-card-small'; // A smaller card for unpaid orders
                    div.innerHTML = `
                        <div>注文 ${order.id} (支払番号: ${order.payment_number})</div>
                        <div>${new Date(order.created_at).toLocaleTimeString('ja-JP')}</div>
                    `;
                    unpaidList.appendChild(div);
                });
            }
        }

        updateStatuses();
    } catch (error) {
        console.error('注文取得エラー:', error);
    }
}

function updateOrderStatus(orderId, status, confirmationMessage) {
    if (confirmationMessage && !confirm(confirmationMessage)) {
        return;
    }

    fetch(API_BASE + `api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    })
    .then(async res => {
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ detail: 'ステータス更新中に不明なエラーが発生しました。' }));
            throw new Error(errorData.detail || `HTTP ${res.status}`);
        }
        return res.json();
    })
    .then(() => {
        // すべての関連ビューをリロード
        if (currentMode === 'kitchen') loadOrders();
        if (currentMode === 'cashier') loadHistory();
        if (currentMode === 'admin') {
            loadAdminOrders();
            // 売上は 'completed' の時のみ更新するのが一般的
            if (status === 'completed') {
                loadRealtimeSales();
                loadSalesByTime();
            }
        }
        // notie.js を使って通知
        notie.alert({ type: 'success', text: `注文 ${orderId} のステータスを「${getStatusText(status)}」に更新しました。` });
    })
    .catch(error => {
        console.error('ステータス更新エラー:', error);
        alert(`エラー: ${error.message}`);
    });
}

function updateStatuses() {
    elements.orderStatuses.innerHTML = activeOrders.map(order => `<div>注文${order.id}: ${order.status}</div>`).join('');
}
// WebSocket
let reconnectInterval = 1000; // Initial reconnect delay 1s
const maxReconnectInterval = 30000; // Max reconnect delay 30s
let messageQueue = [];

function connectWebSocket() {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        return;
    }

    websocket = new WebSocket(WS_BASE);

    websocket.onopen = () => {
        console.log('WebSocket接続');
        reconnectInterval = 1000; // Reset reconnect interval on successful connection
        processMessageQueue();
    };

    websocket.onmessage = (event) => {
        console.log('WebSocket受信:', event.data);
        try {
            const data = JSON.parse(event.data);
            // Handle different message types based on mode
            if (data.type === 'new_order' || data.type === 'update_order') {
                 if (currentMode === 'kitchen') {
                    loadOrders();
                }
                if (currentMode === 'cashier') {
                    loadHistory();
                }
                if (currentMode === 'admin') {
                    loadAdminOrders();
                    loadRealtimeSales();
                }
            } else if (data.type === 'menu_update') {
                if (currentMode === 'cashier') {
                    loadMenus();
                }
                if (currentMode === 'admin') {
                    loadMenuPriceManagement();
                }
            }
        } catch (error) {
            console.log('Received non-JSON message:', event.data);
        }
    };

    websocket.onclose = () => {
        console.log(`WebSocket切断。${reconnectInterval / 1000}秒後に再接続します。`);
        websocket = null;
        setTimeout(connectWebSocket, reconnectInterval);
        // Increase reconnect interval for next time (exponential backoff)
        reconnectInterval = Math.min(reconnectInterval * 2, maxReconnectInterval);
    };

    websocket.onerror = (error) => {
        console.error('WebSocketエラー:', error);
        // onerror will likely be followed by onclose, which handles reconnection.
    };
}

function sendMessage(message) {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify(message));
    } else {
        console.log('WebSocket is not open. Queuing message:', message);
        messageQueue.push(message);
        // If the socket is closed or connecting, the onclose handler will manage the reconnect attempt.
        // If it's the very first attempt, we might need to trigger connection.
        if (!websocket || websocket.readyState === WebSocket.CLOSED) {
             connectWebSocket();
        }
    }
}

function processMessageQueue() {
    while (messageQueue.length > 0) {
        const message = messageQueue.shift();
        console.log('Processing queued message:', message);
        sendMessage(message);
    }
}

// タイマー機能

// タイマー機能

let activeTimers = [];
let timerIdCounter = 1;

// タイマーセクションの折りたたみ
function toggleTimerSection() {
    const timerSection = document.querySelector('.timer-section');
    const toggleIcon = document.querySelector('.toggle-icon');
    
    timerSection.classList.toggle('collapsed');
    
    if (timerSection.classList.contains('collapsed')) {
        toggleIcon.textContent = '▶';
    } else {
        toggleIcon.textContent = '▼';
    }
}

// 新しいタイマーを追加
// 新しいタイマーを追加（デフォルト5分）
function addNewTimer() {
    const totalSeconds = 5 * 60; // 固定で5分
    
    const timer = {
        id: timerIdCounter++,
        name: `タイマー${timerIdCounter - 1}`,
        duration: totalSeconds,
        remaining: totalSeconds,
        interval: null,
        state: 'running', // 'running', 'paused', 'finished'
        startTime: Date.now()
    };
    
    activeTimers.push(timer);
    
    // タイマー開始
    startTimerCountdown(timer);
    
    renderActiveTimers();
}
// タイマーのカウントダウン開始
function startTimerCountdown(timer) {
    timer.interval = setInterval(() => {
        if (timer.state === 'running') {
            timer.remaining--;
            
            if (timer.remaining <= 0) {
                timer.state = 'finished';
                clearInterval(timer.interval);
                
                // 通知
                showTimerNotification(timer.name);
                alert(`🔔 ${timer.name} 完了！調理時間です！`);
            }
            
            renderActiveTimers();
        }
    }, 1000);
}

// タイマー通知
function showTimerNotification(timerName) {
    if ('Notification' in window) {
        if (Notification.permission === 'granted') {
            new Notification('調理タイマー', {
                body: `${timerName} が完了しました！`,
                icon: '/favicon.ico'
            });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(function (permission) {
                if (permission === 'granted') {
                    new Notification('調理タイマー', {
                        body: `${timerName} が完了しました！`,
                        icon: '/favicon.ico'
                    });
                }
            });
        }
    }
}

// タイマー一時停止
function pauseTimer(timerId) {
    const timer = activeTimers.find(t => t.id === timerId);
    if (timer && timer.state === 'running') {
        timer.state = 'paused';
        renderActiveTimers();
    }
}

// タイマー再開
function resumeTimer(timerId) {
    const timer = activeTimers.find(t => t.id === timerId);
    if (timer && timer.state === 'paused') {
        timer.state = 'running';
        renderActiveTimers();
    }
}

// タイマー削除
function removeTimer(timerId) {
    const timerIndex = activeTimers.findIndex(t => t.id === timerId);
    if (timerIndex !== -1) {
        const timer = activeTimers[timerIndex];
        if (timer.interval) {
            clearInterval(timer.interval);
        }
        activeTimers.splice(timerIndex, 1);
        renderActiveTimers();
    }
}

// アクティブタイマーを表示
function renderActiveTimers() {
    try {
        const timersList = document.getElementById('timers-list');
        if (!timersList) return;
        
        if (activeTimers.length === 0) {
            timersList.innerHTML = '<div class="no-timers">アクティブなタイマーはありません</div>';
            return;
        }
        
        timersList.innerHTML = '';
        
        activeTimers.forEach(timer => {
            const minutes = Math.floor(timer.remaining / 60);
            const seconds = timer.remaining % 60;
            const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            let statusText = '';
            let actionButtons = '';
            
            if (timer.state === 'finished') {
                statusText = '完了！';
                actionButtons = `<button class="remove-timer-btn" onclick="removeTimer(${timer.id})">削除</button>`;
            } else if (timer.state === 'paused') {
                statusText = '一時停止';
                actionButtons = `
                    <button class="resume-timer-btn" onclick="resumeTimer(${timer.id})">再開</button>
                    <button class="remove-timer-btn" onclick="removeTimer(${timer.id})">削除</button>
                `;
            } else {
                statusText = '調理中';
                actionButtons = `
                    <button class="pause-timer-btn" onclick="pauseTimer(${timer.id})">一時停止</button>
                    <button class="remove-timer-btn" onclick="removeTimer(${timer.id})">削除</button>
                `;
            }
            
            const timerItem = document.createElement('div');
            timerItem.className = `timer-item ${timer.state}`;
            timerItem.innerHTML = `
                <div class="timer-info">
                    <span class="timer-name">${timer.name}</span>
                    <span class="timer-remaining">${timer.state === 'finished' ? '完了!' : timeStr}</span>
                    <span class="timer-status">${statusText}</span>
                </div>
                <div class="timer-actions">
                    ${actionButtons}
                </div>
            `;
            timersList.appendChild(timerItem);
        });
    } catch (error) {
        console.error("タイマー表示エラー:", error);
    }
}

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    try {
        renderActiveTimers();
        
        // 通知許可をリクエスト
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    } catch (error) {
        console.error("初期化中にエラーが発生しました:", error);
        // ユーザーにエラーを通知することも検討
        // alert("ページの読み込み中にエラーが発生しました。");
    }
});

// リアルタイム売上データロード
async function loadRealtimeSales() {
    if (currentMode !== 'admin') return;
    
    try {
        const salesData = await fetchWithError('api/orders/sales/realtime');
        if (elements.dailyTotal) {
            elements.dailyTotal.textContent = `${salesData.daily_total}円`;
        }
        if (elements.pastHourTotal) {
            elements.pastHourTotal.textContent = `${salesData.past_hour_total}円`;
        }
        if (elements.past30minTotal) {
            elements.past30minTotal.textContent = `${salesData.past_30min_total}円`;
        }
        
        // 商品別売上を表示
        if (elements.menuSalesList && salesData.menu_sales) {
            elements.menuSalesList.innerHTML = '';
            if (salesData.menu_sales.length === 0) {
                elements.menuSalesList.innerHTML = '<div class="no-menu-sales">今日はまだ売上がありません</div>';
            } else {
                salesData.menu_sales.forEach(item => {
                    const salesItem = document.createElement('div');
                    salesItem.className = 'menu-sales-item';
                    salesItem.innerHTML = `
                        <div class="menu-sales-info">
                            <div class="menu-sales-name">${item.menu_name}</div>
                            <div class="menu-sales-quantity">${item.quantity_sold}個</div>
                        </div>
                        <div class="menu-sales-total">${item.total_sales}円</div>
                    `;
                    elements.menuSalesList.appendChild(salesItem);
                });
            }
        }
    } catch (error) {
        console.error('リアルタイム売上取得エラー:', error);
    }
}

// 時間別売上データロード
// 今日の時間別売上データロード
async function loadSalesByTime() {
    if (currentMode !== 'admin') return;
    
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const salesData = await fetchWithError(`api/orders/sales/by-time?start=${today}&end=${today}`);
        
        if (elements.salesData) {
            elements.salesData.innerHTML = '';
            if (salesData.length === 0) {
                elements.salesData.innerHTML = '<p>今日はまだ売上データがありません</p>';
            } else {
                salesData.forEach(data => {
                    const div = document.createElement('div');
                    div.className = 'sales-item';
                    div.innerHTML = `
                        <span>${data.time_slot}</span>
                        <span>${data.total}円</span>
                    `;
                    elements.salesData.appendChild(div);
                });
            }
        }
    } catch (error) {
        console.error('時間別売上取得エラー:', error);
    }
}
// 管理画面用注文リスト読み込み
async function loadAdminOrders() {
    if (currentMode !== 'admin') return;
    
    try {
        const orders = await fetchWithError('api/orders/');
        
        if (elements.adminOrdersList) {
            elements.adminOrdersList.innerHTML = '';
            
            if (orders.length === 0) {
                elements.adminOrdersList.innerHTML = '<div class="no-orders">注文がありません</div>';
                return;
            }
            
            // 注文を新しい順にソート
            orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            
            orders.forEach(order => {
                const orderTime = new Date(order.created_at).toLocaleString('ja-JP', {
                    timeZone: 'Asia/Tokyo',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                const statusText = getStatusText(order.status);
                const statusClass = `status-${order.status}`;
                
                const orderItem = document.createElement('div');
                orderItem.className = 'admin-order-item';
                orderItem.innerHTML = `
                    <div class="admin-order-info">
                        <div class="admin-order-id">注文 ${order.id}</div>
                        <div class="admin-order-time">${orderTime}</div>
                        <div class="admin-order-price">${order.total_price}円</div>
                    </div>
                    <div class="admin-order-status ${statusClass}">${statusText}</div>
                `;
                elements.adminOrdersList.appendChild(orderItem);
            });
        }
    } catch (error) {
        console.error('管理画面注文リスト取得エラー:', error);
    }
}

// 商品価格管理機能
async function loadMenuPriceManagement() {
    if (currentMode !== 'admin') return;
    
    try {
        const menus = await fetchWithError('api/menus/');
        
        if (elements.menuPriceList) {
            elements.menuPriceList.innerHTML = '';
            
            if (menus.length === 0) {
                elements.menuPriceList.innerHTML = '<div class="no-menus">メニューがありません</div>';
                return;
            }
            
            menus.forEach(menu => {
                const priceItem = document.createElement('div');
                priceItem.className = 'menu-price-item';
                priceItem.innerHTML = `
                    <div class="menu-price-info">
                        <div class="menu-price-name">${menu.name}</div>
                        <div class="menu-price-current">現在: ${menu.price}円</div>
                    </div>
                    <div class="menu-price-controls">
                        <input type="number" class="menu-price-input" value="${menu.price}" min="0" step="10" id="price-${menu.id}">
                        <button class="menu-price-update-btn" onclick="updateMenuPrice(${menu.id})">更新</button>
                    </div>
                `;
                elements.menuPriceList.appendChild(priceItem);
            });
        }
    } catch (error) {
        console.error('メニュー価格管理取得エラー:', error);
    }
}

// メニュー価格更新
async function updateMenuPrice(menuId) {
    const priceInput = document.getElementById(`price-${menuId}`);
    const newPrice = parseFloat(priceInput.value);
    
    if (isNaN(newPrice) || newPrice < 0) {
        alert('正しい価格を入力してください');
        return;
    }
    
    if (!confirm(`メニューの価格を${newPrice}円に変更しますか？`)) {
        return;
    }
    
    try {
        await fetchWithError(`api/menus/${menuId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ price: newPrice })
        });
        
        alert('価格を更新しました');
        loadMenuPriceManagement();
        
        // レジ側のメニューも更新
        if (currentMode === 'cashier') {
            loadMenus();
        }
    } catch (error) {
        console.error('価格更新エラー:', error);
        alert('価格の更新に失敗しました');
    }
}

// ステータステキストを取得
function getStatusText(status) {
    const statusMap = {
        'unpaid': '未払い',
        'pending': '受付済み',
        'preparing': '調理中',
        'ready': '完成',
        'completed': '完了',
        'cancelled': 'キャンセル済み'
    };
    return statusMap[status] || status;
}

// 初期化
connectWebSocket();
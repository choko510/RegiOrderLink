const API_BASE = '/api';

let cart = [];
let menuData = [];

const elements = {
    menusGrid: document.getElementById('menus-grid'),
    cartItems: document.getElementById('cart-items'),
    cartTotal: document.getElementById('cart-total'),
    orderSubmitBtn: document.getElementById('order-submit-btn'),
    paymentNumberDisplay: document.getElementById('payment-number-display'),
    orderConfirmationModal: new bootstrap.Modal(document.getElementById('order-confirmation-modal')),
    explanationModal: new bootstrap.Modal(document.getElementById('explanation-modal'))
};

// --- Utility Functions ---
function fetchWithError(url, options = {}) {
    return fetch(API_BASE + url, options).then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    });
}

// --- Menu Loading ---
async function loadMenus() {
    try {
        const menus = await fetchWithError('/menus/');
        menuData = menus;
        elements.menusGrid.innerHTML = '';
        menus.forEach(menu => {
            const col = document.createElement('div');
            col.className = 'col';
            col.innerHTML = `
                <div class="card h-100 ${menu.is_out_of_stock ? 'border-danger' : ''}">
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title">${menu.name}</h5>
                        <p class="card-text">${menu.price}円</p>
                        <button class="btn btn-primary mt-auto" ${menu.is_out_of_stock ? 'disabled' : ''} onclick="addToCart(${menu.id})">
                            ${menu.is_out_of_stock ? '品切れ' : '追加'}
                        </button>
                    </div>
                </div>
            `;
            elements.menusGrid.appendChild(col);
        });
    } catch (error) {
        console.error('メニュー取得エラー:', error);
        elements.menusGrid.innerHTML = '<p class="text-danger">メニューの読み込みに失敗しました。</p>';
    }
}

// --- Cart Management ---
function addToCart(menuId) {
    const menu = menuData.find(m => m.id === menuId);
    if (menu.is_out_of_stock) {
        alert('この商品は品切れです。');
        return;
    }

    const existing = cart.find(item => item.menuId === menuId);
    if (existing) {
        existing.quantity++;
    } else {
        cart.push({ menuId, name: menu.name, price: menu.price, quantity: 1 });
    }
    updateCart();
    notie.alert({ type: 'success', text: `${menu.name}をカートに追加しました`, time: 2 });
}

function removeFromCart(menuId) {
    const itemIndex = cart.findIndex(item => item.menuId === menuId);
    if (itemIndex > -1) {
        cart.splice(itemIndex, 1);
    }
    updateCart();
}

function updateCart() {
    elements.cartItems.innerHTML = '';
    let total = 0;
    if (cart.length === 0) {
        const li = document.createElement('li');
        li.className = 'list-group-item';
        li.textContent = 'カートは空です。';
        elements.cartItems.appendChild(li);
    } else {
        cart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            li.innerHTML = `
                <div>${item.name} x${item.quantity}</div>
                <div class="d-flex align-items-center">
                    <span class="me-3">${itemTotal}円</span>
                    <button class="btn btn-danger btn-sm" onclick="removeFromCart(${item.menuId})">削除</button>
                </div>
            `;
            elements.cartItems.appendChild(li);
        });
    }
    elements.cartTotal.textContent = `合計: ${total}円`;
}

// --- Order Submission ---
elements.orderSubmitBtn.onclick = async () => {
    if (cart.length === 0) {
        alert('カートに商品がありません。');
        return;
    }

    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    try {
        const response = await fetchWithError('/orders/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                order_items: cart.map(item => ({ menu_id: item.menuId, quantity: item.quantity })),
                total_price: total
            })
        });

        showConfirmationScreen(response.payment_number);

    } catch (error) {
        console.error('注文作成エラー:', error);
        alert('注文の作成に失敗しました。時間をおいて再度お試しください。');
    }
};

function showConfirmationScreen(paymentNumber) {
    elements.paymentNumberDisplay.textContent = paymentNumber;
    elements.orderConfirmationModal.show();
    cart = [];
    updateCart();
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    elements.explanationModal.show();
    loadMenus();
    updateCart();
});
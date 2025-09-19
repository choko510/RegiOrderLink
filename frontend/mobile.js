const API_BASE = 'http://localhost:8000';

let cart = [];

const elements = {
    menusGrid: document.getElementById('menus-grid'),
    cartItems: document.getElementById('cart-items'),
    cartTotal: document.getElementById('cart-total'),
    orderSubmitBtn: document.getElementById('order-submit-btn'),
    orderScreen: document.getElementById('order-screen'),
    cartSection: document.getElementById('cart-section'),
    orderConfirmation: document.getElementById('order-confirmation'),
    paymentNumberDisplay: document.getElementById('payment-number-display')
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
        elements.menusGrid.innerHTML = '<p>メニューの読み込みに失敗しました。</p>';
    }
}

// --- Cart Management ---
function addToCart(menuId, name, price) {
    const existing = cart.find(item => item.menuId === menuId);
    if (existing) {
        existing.quantity++;
    } else {
        cart.push({ menuId, name, price, quantity: 1 });
    }
    updateCart();
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
        elements.cartItems.innerHTML = '<p>カートは空です。</p>';
    } else {
        cart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;
            const div = document.createElement('div');
            div.className = 'cart-item';
            div.innerHTML = `
                <span>${item.name} x${item.quantity}</span>
                <span>${itemTotal}円</span>
                <button onclick="removeFromCart(${item.menuId})">削除</button>
            `;
            elements.cartItems.appendChild(div);
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
    elements.orderScreen.classList.add('hidden');
    elements.cartSection.classList.add('hidden');
    elements.orderConfirmation.classList.remove('hidden');
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    loadMenus();
    updateCart();
});

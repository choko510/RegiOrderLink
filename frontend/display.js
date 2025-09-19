document.addEventListener('DOMContentLoaded', function() {
    const pendingList = document.getElementById('pending-list');
    const preparingList = document.getElementById('preparing-list');
    const readyList = document.getElementById('ready-list');

    const API_BASE_URL = window.location.origin;
    const WS_BASE_URL = window.location.origin.replace(/^http/, 'ws')+"/ws";

    function createOrderCard(order) {
        const card = document.createElement('div');
        card.className = 'order-card';
        card.id = `order-${order.id}`;

        // Order Identifier (e.g., Table No., Payment No., or Order ID)
        const orderIdentifier = document.createElement('div');
        orderIdentifier.className = 'order-identifier';
        orderIdentifier.textContent = order.payment_number || order.table_id || order.id;
        card.appendChild(orderIdentifier);

        // List of items
        const itemList = document.createElement('ul');
        itemList.className = 'item-list';
        
        order.order_items.forEach(item => {
            const listItem = document.createElement('li');
            listItem.className = 'item';

            const itemName = document.createElement('span');
            itemName.className = 'item-name';
            itemName.textContent = item.menu.name;

            const itemQuantity = document.createElement('span');
            itemQuantity.className = 'item-quantity';
            itemQuantity.textContent = `x${item.quantity}`;

            listItem.appendChild(itemName);
            listItem.appendChild(itemQuantity);
            itemList.appendChild(listItem);
        });

        card.appendChild(itemList);
        return card;
    }

    function renderOrders(orders) {
        pendingList.innerHTML = '';
        preparingList.innerHTML = '';
        readyList.innerHTML = '';

        if (!orders || orders.length === 0) {
            return;
        }

        orders.forEach(order => {
            const orderCard = createOrderCard(order);
            if (order.status === 'pending') {
                pendingList.appendChild(orderCard);
            } else if (order.status === '調理中' || order.status === 'preparing') {
                preparingList.appendChild(orderCard);
            } else if (order.status === '提供可能' || order.status === 'ready') {
                readyList.appendChild(orderCard);
            }
        });
    }

    async function fetchActiveOrders() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/orders/active`);
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }
            const orders = await response.json();
            renderOrders(orders);
        } catch (error) {
            console.error('Error fetching active orders:', error);
        }
    }

    function setupWebSocket() {
        const ws = new WebSocket(`${WS_BASE_URL}/ws`);
        ws.onopen = () => console.log('WebSocket connection established');
        ws.onmessage = event => {
            console.log('WebSocket message received:', event.data);
            // Re-fetch all data on any update
            fetchActiveOrders();
        };
        ws.onclose = () => {
            setTimeout(setupWebSocket, 3000);
        };
        ws.onerror = error => {
            console.error('WebSocket error:', error);
            ws.close();
        };
    }

    fetchActiveOrders();
    setupWebSocket();
});

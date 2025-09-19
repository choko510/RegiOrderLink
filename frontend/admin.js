document.addEventListener('DOMContentLoaded', function() {
    const menuList = document.getElementById('menu-list');

    // Function to fetch menus and display them
    async function fetchMenus() {
        try {
            const response = await fetch('/api/menus/');
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const menus = await response.json();
            displayMenus(menus);
        } catch (error) {
            console.error('Error fetching menus:', error);
            menuList.innerHTML = '<p>メニューの読み込みに失敗しました。</p>';
        }
    }

    // Function to display menus
    function displayMenus(menus) {
        menuList.innerHTML = '';
        menus.forEach(menu => {
            const menuDiv = document.createElement('div');
            menuDiv.classList.add('menu-item');
            if (menu.is_out_of_stock) {
                menuDiv.classList.add('out-of-stock');
            }

            const menuName = document.createElement('span');
            menuName.textContent = menu.name;

            const stockButton = document.createElement('button');
            stockButton.textContent = menu.is_out_of_stock ? '在庫あり' : '品切れ';
            stockButton.addEventListener('click', () => toggleStockStatus(menu.id, !menu.is_out_of_stock));

            menuDiv.appendChild(menuName);
            menuDiv.appendChild(stockButton);
            menuList.appendChild(menuDiv);
        });
    }

    // Function to toggle stock status
    async function toggleStockStatus(menuId, isOutOfStock) {
        try {
            const response = await fetch(`/api/menus/${menuId}`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ is_out_of_stock: isOutOfStock }),
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            // Refresh the menu list
            fetchMenus();
        } catch (error) {
            console.error('Error updating stock status:', error);
        }
    }

    // Initial fetch
    fetchMenus();
});
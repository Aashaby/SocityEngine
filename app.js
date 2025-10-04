// 社交网络分析系统 - 前端应用
class SocialNetworkApp {
    constructor() {
        this.data = null;
        this.currentPerson = null;
        this.encryptionKey = null;
        this.init();
    }

    init() {
        // 绑定登录表单
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        // 绑定搜索
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchPeople(e.target.value);
        });

        // 检查是否有保存的密钥
        this.checkSavedKey();
    }

    checkSavedKey() {
        const savedData = localStorage.getItem('encryptionKey');
        if (savedData) {
            try {
                const keyData = JSON.parse(savedData);
                const now = new Date().getTime();
                
                // 检查是否过期
                if (now < keyData.expiry) {
                    // 未过期，自动登录
                    document.getElementById('encryptionKey').value = keyData.key;
                    document.getElementById('rememberKey').checked = true;
                    
                    this.encryptionKey = keyData.key;
                    this.autoLogin();
                } else {
                    // 已过期，清除密钥
                    console.log('密钥已过期（24小时），已自动清除');
                    localStorage.removeItem('encryptionKey');
                }
            } catch (e) {
                // 兼容旧格式（直接存储的字符串）
                console.log('检测到旧格式密钥，转换为新格式');
                const oldKey = savedData;
                document.getElementById('encryptionKey').value = oldKey;
                document.getElementById('rememberKey').checked = true;
                
                // 转换为新格式
                const now = new Date().getTime();
                const keyData = {
                    key: oldKey,
                    expiry: now + (24 * 60 * 60 * 1000)
                };
                localStorage.setItem('encryptionKey', JSON.stringify(keyData));
                
                this.encryptionKey = oldKey;
                this.autoLogin();
            }
        }
    }

    async autoLogin() {
        console.log('自动登录中...');
        this.showLoading();
        
        try {
            await this.loadAndDecryptData();
            this.showMainInterface();
            this.renderStats();
            this.renderPeopleList();
        } catch (error) {
            console.error('自动登录失败:', error);
            // 自动登录失败，清除保存的密钥
            localStorage.removeItem('encryptionKey');
            // 显示登录界面
            this.hideLoading();
            document.getElementById('loginContainer').style.display = 'flex';
            this.showError('自动登录失败，密钥可能已过期或不正确，请重新输入');
        }
    }

    async login() {
        const key = document.getElementById('encryptionKey').value;
        const rememberKey = document.getElementById('rememberKey').checked;
        
        this.encryptionKey = key;

        // 保存或删除密钥
        if (rememberKey) {
            const now = new Date().getTime();
            const keyData = {
                key: key,
                expiry: now + (24 * 60 * 60 * 1000) // 24小时后过期
            };
            localStorage.setItem('encryptionKey', JSON.stringify(keyData));
        } else {
            localStorage.removeItem('encryptionKey');
        }

        this.showLoading();
        this.hideError();

        try {
            await this.loadAndDecryptData();
            this.showMainInterface();
            this.renderStats();
            this.renderPeopleList();
        } catch (error) {
            console.error('登录失败:', error);
            // 登录失败，清除可能保存的错误密钥
            localStorage.removeItem('encryptionKey');
            this.showError('密钥错误或数据加载失败，请检查密钥是否正确');
            this.hideLoading();
            // 确保停留在登录界面
            document.getElementById('loginContainer').style.display = 'flex';
            document.getElementById('mainContainer').classList.add('hidden');
        }
    }

    async loadAndDecryptData() {
        try {
            // 步骤1: 加载加密数据（gzip压缩）
            this.updateLoadingStep(1, '加载加密数据...');
            await this.sleep(300);
            const response = await fetch('public/data/network.enc.json.gz');
            if (!response.ok) throw new Error('无法加载数据文件');
            
            // 解压缩 gzip
            const blob = await response.blob();
            const ds = new DecompressionStream('gzip');
            const decompressedStream = blob.stream().pipeThrough(ds);
            const decompressedBlob = await new Response(decompressedStream).blob();
            const text = await decompressedBlob.text();
            const encryptedData = JSON.parse(text);
            
            this.completeLoadingStep(1);
            
            // 步骤2: 派生解密密钥
            this.updateLoadingStep(2, '派生解密密钥...');
            await this.sleep(200);
            this.completeLoadingStep(2);
            
            // 步骤3: 解密数据
            this.updateLoadingStep(3, '解密数据中...');
            await this.sleep(100);
            const decrypted = this.decryptData(encryptedData);
            this.completeLoadingStep(3);
            
            // 步骤4: 解析网络数据
            this.updateLoadingStep(4, '解析网络数据...');
            await this.sleep(200);
            this.data = JSON.parse(decrypted);
            this.completeLoadingStep(4);
            
            // 步骤5: 初始化界面
            this.updateLoadingStep(5, '初始化界面...');
            await this.sleep(300);
            this.completeLoadingStep(5);
            
            console.log('数据加载成功:', this.data.stats);
        } catch (error) {
            throw new Error('数据解密失败: ' + error.message);
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    updateLoadingStep(step, text) {
        const stepElement = document.querySelector(`[data-step="${step}"]`);
        if (stepElement) {
            // 移除其他active状态
            document.querySelectorAll('.loading-step').forEach(el => {
                el.classList.remove('active');
            });
            stepElement.classList.add('active');
        }
        document.getElementById('loadingText').textContent = text;
    }

    completeLoadingStep(step) {
        const stepElement = document.querySelector(`[data-step="${step}"]`);
        if (stepElement) {
            stepElement.classList.remove('active');
            stepElement.classList.add('done');
        }
    }

    decryptData(encryptedData) {
        try {
            // 使用与Python相同的PBKDF2算法
            const salt = CryptoJS.enc.Base64.parse(encryptedData.salt);
            const iterations = encryptedData.iterations || 100000;
            
            // 派生密钥（与Python crypto_utils.py完全一致）
            const key = CryptoJS.PBKDF2(this.encryptionKey, salt, {
                keySize: 256/32,  // 32 bytes = 256 bits
                iterations: iterations,
                hasher: CryptoJS.algo.SHA256
            });

            // Base64解码加密数据
            const encryptedBytes = CryptoJS.enc.Base64.parse(encryptedData.encrypted);
            
            // Python格式: IV(16字节) + 密文
            // 提取IV（前16字节 = 前4个Word）
            const iv = CryptoJS.lib.WordArray.create(encryptedBytes.words.slice(0, 4));
            
            // 提取密文（剩余部分）
            const ciphertext = CryptoJS.lib.WordArray.create(
                encryptedBytes.words.slice(4),
                encryptedBytes.sigBytes - 16
            );
            
            // 使用AES-CBC解密
            const decrypted = CryptoJS.AES.decrypt(
                { ciphertext: ciphertext },
                key,
                {
                    iv: iv,
                    mode: CryptoJS.mode.CBC,
                    padding: CryptoJS.pad.Pkcs7
                }
            );

            const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);
            
            if (!decryptedStr) {
                throw new Error('解密结果为空，请检查密钥是否正确');
            }

            return decryptedStr;
        } catch (error) {
            console.error('解密错误详情:', error);
            throw new Error('解密失败: ' + error.message);
        }
    }

    showMainInterface() {
        document.getElementById('loginContainer').classList.add('hidden');
        document.getElementById('mainContainer').classList.remove('hidden');
        this.hideLoading();
    }

    renderStats() {
        const stats = this.data.stats;
        document.getElementById('totalPeople').textContent = stats.total_people;
        document.getElementById('totalRelationships').textContent = stats.total_relationships;
        document.getElementById('avgConnections').textContent = stats.average_connections;
        document.getElementById('networkDensity').textContent = stats.network_density + '%';
    }

    renderPeopleList(people = null, searchQuery = '') {
        const listContainer = document.getElementById('personList');
        listContainer.innerHTML = '';

        if (!people) {
            people = this.data.people;
        }

        // 如果没有结果，显示提示
        if (people.length === 0) {
            listContainer.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-secondary);">
                    <div style="font-size: 48px; margin-bottom: 20px;">🔍</div>
                    <h3 style="margin-bottom: 10px;">未找到匹配的人员</h3>
                    <p>请尝试其他搜索关键词</p>
                </div>
            `;
            return;
        }

        // 限制显示数量
        people = people.slice(0, 50);

        people.forEach(person => {
            const card = document.createElement('div');
            card.className = 'person-card';
            card.onclick = () => this.showPersonDetail(person.id);

            card.innerHTML = `
                <h4>${person.name}</h4>
                <div class="info">
                    ${person.gender} | 班级: ${person.current_class}
                    ${person.dorm !== '未知' ? `| 宿舍: ${person.dorm}` : ''}
                    ${person.hometown && person.hometown !== '未知' ? `<br>📍 ${person.hometown}` : ''}
                </div>
                <div>
                    <span class="badge">👥 ${person.connections.length}</span>
                    <span class="badge">💡 ${person.recommendations.length}</span>
                </div>
            `;

            listContainer.appendChild(card);
        });
    }

    searchPeople(query) {
        if (!this.data) return;

        const filtered = this.data.people.filter(person => {
            const searchText = query.toLowerCase();
            return person.name.toLowerCase().includes(searchText) ||
                   person.current_class.includes(searchText) ||
                   person.dorm.includes(searchText);
        });

        this.renderPeopleList(filtered, query);
    }

    showPersonDetail(personId) {
        const person = this.data.people.find(p => p.id === personId);
        if (!person) return;

        this.currentPerson = person;

        // 显示详情区域
        document.getElementById('detailSection').classList.add('show');
        document.getElementById('detailName').textContent = person.name;

        // 滚动到详情区域
        document.getElementById('detailSection').scrollIntoView({ behavior: 'smooth' });

        // 渲染关系列表
        this.renderConnections(person);
        this.renderRecommendations(person);
        
        // 如果当前在关系图谱标签，重新绘制
        if (document.getElementById('graphTab').classList.contains('active')) {
            this.drawRelationshipGraph();
        }
    }

    renderConnections(person) {
        const container = document.getElementById('connectionsList');
        container.innerHTML = '';

        // 更新数量显示
        document.getElementById('connectionsCount').textContent = person.connections.length;

        if (person.connections.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">暂无关系数据</p>';
            return;
        }

        // 按得分排序
        const sortedConnections = [...person.connections].sort((a, b) => b.score - a.score);

        sortedConnections.forEach(connection => {
            const connectedPerson = this.data.people.find(p => p.id === connection.person_id);
            if (!connectedPerson) return;

            const item = document.createElement('div');
            item.className = 'connection-item';
            item.innerHTML = `
                <div class="connection-info">
                    <h4>${connectedPerson.name}</h4>
                    <div class="reasons">
                        ${connection.reasons.join(' · ')}
                        <br>
                        ${connectedPerson.gender} | 班级: ${connectedPerson.current_class}
                        ${connectedPerson.dorm !== '未知' ? `| 宿舍: ${connectedPerson.dorm}` : ''}
                        ${connectedPerson.hometown && connectedPerson.hometown !== '未知' ? `<br>📍 ${connectedPerson.hometown}` : ''}
                    </div>
                </div>
                <div class="connection-score">${connection.score}</div>
            `;
            item.style.cursor = 'pointer';
            item.onclick = () => this.showPersonDetail(connectedPerson.id);

            container.appendChild(item);
        });
    }

    renderRecommendations(person) {
        const container = document.getElementById('recommendationsList');
        container.innerHTML = '';

        // 更新数量显示
        document.getElementById('recommendationsCount').textContent = person.recommendations.length;

        if (person.recommendations.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">暂无推荐</p>';
            return;
        }

        person.recommendations.forEach(recommendation => {
            const recommendedPerson = this.data.people.find(p => p.id === recommendation.person_id);
            if (!recommendedPerson) return;

            const item = document.createElement('div');
            item.className = 'connection-item';
            item.innerHTML = `
                <div class="connection-info">
                    <h4>${recommendedPerson.name}</h4>
                    <div class="reasons">
                        ${recommendation.reason}
                        <br>
                        ${recommendedPerson.gender} | 班级: ${recommendedPerson.current_class}
                        ${recommendedPerson.dorm !== '未知' ? `| 宿舍: ${recommendedPerson.dorm}` : ''}
                        ${recommendedPerson.hometown && recommendedPerson.hometown !== '未知' ? `<br>📍 ${recommendedPerson.hometown}` : ''}
                    </div>
                </div>
                <div class="connection-score" style="color: var(--warning);">${recommendation.score}</div>
            `;
            item.style.cursor = 'pointer';
            item.onclick = () => this.showPersonDetail(recommendedPerson.id);

            container.appendChild(item);
        });
    }

    closeDetail() {
        document.getElementById('detailSection').classList.remove('show');
    }

    switchTab(tabName) {
        // 更新标签状态
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        event.target.classList.add('active');

        // 更新内容显示
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        if (tabName === 'connections') {
            document.getElementById('connectionsTab').classList.add('active');
        } else if (tabName === 'graph') {
            document.getElementById('graphTab').classList.add('active');
            // 绘制关系图
            this.drawRelationshipGraph();
        } else if (tabName === 'recommendations') {
            document.getElementById('recommendationsTab').classList.add('active');
        }
    }

    drawRelationshipGraph() {
        if (!this.currentPerson) return;

        const canvas = document.getElementById('relationshipCanvas');
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // 清空画布
        ctx.clearRect(0, 0, width, height);
        
        // 添加点击事件监听
        canvas.onclick = (e) => this.handleCanvasClick(e, canvas);

        // 获取当前人和他的关系，按得分排序取前20个
        const person = this.currentPerson;
        const connections = [...person.connections]
            .sort((a, b) => b.score - a.score)  // 按得分降序排序
            .slice(0, 20);  // 取前20个最强关系

        if (connections.length === 0) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('暂无关系数据', width / 2, height / 2);
            return;
        }

        // 节点数据
        this.graphNodes = [
            { id: person.id, name: person.name, gender: person.gender, x: width / 2, y: height / 2, isCenter: true, radius: 30 }
        ];

        // 添加关系节点（圆形布局）
        const layoutRadius = Math.min(width, height) * 0.35;
        connections.forEach((conn, i) => {
            const connPerson = this.data.people.find(p => p.id === conn.person_id);
            if (connPerson) {
                const angle = (i / connections.length) * Math.PI * 2;
                this.graphNodes.push({
                    id: connPerson.id,
                    name: connPerson.name,
                    gender: connPerson.gender,  // 添加性别信息
                    x: width / 2 + Math.cos(angle) * layoutRadius,
                    y: height / 2 + Math.sin(angle) * layoutRadius,
                    score: conn.score,
                    isCenter: false,
                    radius: 20
                });
            }
        });

        // 绘制连线
        this.graphNodes.slice(1).forEach((node, i) => {
            const score = node.score;
            
            // 根据得分选择颜色（渐变：红→黄→绿）
            let lineColor;
            if (score >= 100) {
                lineColor = '#10b981';  // 绿色：非常强的关系
            } else if (score >= 80) {
                lineColor = '#22c55e';  // 浅绿色：强关系
            } else if (score >= 60) {
                lineColor = '#eab308';  // 黄色：中等关系
            } else if (score >= 40) {
                lineColor = '#f59e0b';  // 橙色：较弱关系
            } else {
                lineColor = '#ef4444';  // 红色：弱关系
            }
            
            // 线条粗细根据得分
            ctx.lineWidth = Math.max(2, score / 25);
            ctx.strokeStyle = lineColor;

            ctx.beginPath();
            ctx.moveTo(this.graphNodes[0].x, this.graphNodes[0].y);
            ctx.lineTo(node.x, node.y);
            ctx.stroke();

            // 在线上显示得分
            const midX = (this.graphNodes[0].x + node.x) / 2;
            const midY = (this.graphNodes[0].y + node.y) / 2;
            ctx.fillStyle = lineColor;
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(score, midX, midY);
        });

        // 绘制节点
        this.graphNodes.forEach(node => {
            // 根据性别选择颜色
            let nodeColor;
            if (node.isCenter) {
                nodeColor = '#0ea5e9';  // 中心节点：蓝色
            } else {
                nodeColor = node.gender === '男' ? '#3b82f6' : '#ec4899';  // 男：蓝色，女：粉色
            }
            
            // 节点圆圈
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            ctx.fillStyle = nodeColor;
            ctx.fill();
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 2;
            ctx.stroke();

            // 节点文字
            ctx.fillStyle = '#ffffff';
            ctx.font = node.isCenter ? 'bold 14px sans-serif' : '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.name, node.x, node.y);

            // 节点下方显示名字（外部）
            ctx.fillStyle = '#cbd5e1';
            ctx.font = '11px sans-serif';
            ctx.fillText(node.name, node.x, node.y + (node.isCenter ? 45 : 35));
        });

        // 添加图例
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        
        // 左侧：节点图例
        ctx.fillStyle = '#0ea5e9';
        ctx.fillText('● 中心节点', 20, height - 60);
        
        ctx.fillStyle = '#3b82f6';
        ctx.fillText('● 男性', 20, height - 45);
        
        ctx.fillStyle = '#ec4899';
        ctx.fillText('● 女性', 20, height - 30);
        
        // 右侧：线条颜色图例
        ctx.fillStyle = '#10b981';
        ctx.fillText('━ 100+ 非常强', width - 200, height - 60);
        
        ctx.fillStyle = '#22c55e';
        ctx.fillText('━ 80-99 强', width - 200, height - 45);
        
        ctx.fillStyle = '#eab308';
        ctx.fillText('━ 60-79 中等', width - 200, height - 30);
        
        ctx.fillStyle = '#f59e0b';
        ctx.fillText('━ 40-59 较弱', width - 200, height - 15);
        
        // 底部说明
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        ctx.fillText('💡 点击节点查看详情 | 线条粗细和颜色表示关系强度', width / 2, height - 15);
        
        // 设置鼠标样式
        canvas.style.cursor = 'pointer';
    }

    handleCanvasClick(e, canvas) {
        if (!this.graphNodes) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        // 检测点击了哪个节点
        for (const node of this.graphNodes) {
            const distance = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
            if (distance <= node.radius) {
                // 点击了节点，切换到该人的详情
                if (node.id !== this.currentPerson.id) {
                    this.showPersonDetail(node.id);
                }
                return;
            }
        }
    }

    showLoading() {
        const loadingContainer = document.getElementById('loadingContainer');
        const loginContainer = document.getElementById('loginContainer');
        
        loadingContainer.classList.remove('hidden');
        loadingContainer.style.display = 'block';
        loginContainer.style.display = 'none';
        
        // 重置所有步骤状态
        document.querySelectorAll('.loading-step').forEach(el => {
            el.classList.remove('active', 'done');
        });
    }

    hideLoading() {
        const loadingContainer = document.getElementById('loadingContainer');
        loadingContainer.classList.add('hidden');
        loadingContainer.style.display = 'none';
    }

    showError(message) {
        const errorElement = document.getElementById('errorMessage');
        errorElement.textContent = message;
        errorElement.classList.add('show');
    }

    hideError() {
        document.getElementById('errorMessage').classList.remove('show');
    }

    logout() {
        if (confirm('确定要退出吗？将清除保存的密钥。')) {
            // 清除保存的密钥
            localStorage.removeItem('encryptionKey');
            // 重新加载页面，回到登录界面
            location.reload();
        }
    }

    async refreshData() {
        this.showLoading();
        
        try {
            // 重新加载和解密数据
            await this.loadAndDecryptData();
            
            // 重新渲染
            this.renderStats();
            this.renderPeopleList();
            
            // 如果有打开的详情，关闭它
            document.getElementById('detailSection').classList.remove('show');
            
            this.hideLoading();
        } catch (error) {
            console.error('刷新失败:', error);
            this.hideLoading();
            this.showError('数据刷新失败，请重试');
        }
    }
}

// 全局函数
function closeDetail() {
    app.closeDetail();
}

function switchTab(tabName) {
    app.switchTab(tabName);
}

function logout() {
    app.logout();
}

function refreshData() {
    app.refreshData();
}

// 初始化应用
const app = new SocialNetworkApp();

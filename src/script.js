class WSIPortal {
    constructor() {
        this.files = [];
        this.selectedModel = 'sae';
        this.isProcessing = false;
        this.processedFiles = 0;
        this.totalPatches = 0;
        this.startTime = null;
        this.currentPoints = null;
        this.modelLoaded = false;
        
        this.initialize();
    }

    initialize() {
        this.setupEventListeners();
        this.setupTabs();
        this.updateStats();
        console.log('🔬 WSI Portal initialized successfully');
    }

    setupEventListeners() {
        const fileInput = document.getElementById('fileInput');
        const selectFilesBtn = document.getElementById('selectFiles');
        const uploadZone = document.getElementById('uploadZone');

        selectFilesBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => this.handleFileSelection(e.target.files));

        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });

        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('dragover');
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            this.handleFileSelection(e.dataTransfer.files);
        });

        document.querySelectorAll('.model-card').forEach(card => {
            card.addEventListener('click', () => this.selectModel(card));
        });

        document.getElementById('loadModel').addEventListener('click', () => this.loadModel());
        document.getElementById('startAnalysis').addEventListener('click', () => this.startAnalysis());

        this.setupRangeInputs();
    }

    setupRangeInputs() {
        const ranges = [
            { input: 'overlapRatio', display: 'overlapValue' },
            { input: 'tissueThreshold', display: 'tissueValue' },
            { input: 'confidenceThreshold', display: 'confidenceValue' }
        ];

        ranges.forEach(({ input, display }) => {
            const inputEl = document.getElementById(input);
            const displayEl = document.getElementById(display);
            if (inputEl && displayEl) {
                inputEl.addEventListener('input', () => {
                    displayEl.textContent = inputEl.value;
                });
            }
        });
    }

    setupTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                this.switchTab(tabId);
            });
        });
    }

    switchTab(activeTabId) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        document.querySelector(`[data-tab="${activeTabId}"]`).classList.add('active');
        document.getElementById(activeTabId).classList.add('active');
    }

    handleFileSelection(files) {
        const validTypes = ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.svs', '.ndpi'];
        let addedFiles = 0;

        Array.from(files).forEach((file, index) => {
            const isValid = validTypes.some(type => 
                file.name.toLowerCase().includes(type) || file.type.includes(type.slice(1))
            );

            if (isValid) {
                const fileObj = {
                    id: Date.now() + Math.random(),
                    file: file,
                    name: file.name,
                    size: this.formatFileSize(file.size),
                    sizeBytes: file.size,
                    type: this.getFileType(file.name),
                    status: 'pending',
                    url: URL.createObjectURL(file)
                };
                
                this.files.push(fileObj);
                addedFiles++;
            }
        });

        if (addedFiles > 0) {
            this.updateFileList();
            this.updateStats();
            this.showNotification(`Successfully added ${addedFiles} file(s)`, 'success');
            
            if (this.modelLoaded) {
                document.getElementById('startAnalysis').disabled = false;
            }
        } else {
            this.showNotification('No valid files selected. Please choose JPEG, PNG, TIFF, SVS, or NDPI files.', 'error');
        }
    }

    getFileType(filename) {
        const ext = filename.toLowerCase();
        if (ext.includes('.svs') || ext.includes('.ndpi')) return 'WSI';
        if (ext.includes('.tiff') || ext.includes('.tif')) return 'TIFF';
        return 'Standard';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    updateFileList() {
        const fileList = document.getElementById('fileList');
        
        if (this.files.length === 0) {
            fileList.style.display = 'none';
            return;
        }

        fileList.style.display = 'block';
        const listContainer = fileList.querySelector('div') || document.createElement('div');
        listContainer.innerHTML = '';

        this.files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <div class="file-info">
                    <div class="file-icon">${this.getFileIcon(file.type)}</div>
                    <div class="file-details">
                        <h4>${file.name}</h4>
                        <p>${file.type} • ${file.size}</p>
                    </div>
                </div>
                <div class="file-actions">
                    <span class="status-badge status-${file.status}">${file.status}</span>
                    <button class="btn btn-small" onclick="portal.removeFile('${file.id}')">Remove</button>
                </div>
            `;
            listContainer.appendChild(fileItem);
        });

        if (!fileList.contains(listContainer)) {
            fileList.appendChild(listContainer);
        }
    }

    getFileIcon(type) {
        const icons = {
            'WSI': '🔬',
            'TIFF': '🖼️',
            'Standard': '📷'
        };
        return icons[type] || '📁';
    }

    removeFile(fileId) {
        this.files = this.files.filter(f => f.id !== fileId);
        this.updateFileList();
        this.updateStats();
        this.showNotification('File removed', 'info');
    }

    updateStats() {
        document.getElementById('totalFiles').textContent = this.files.length;
        
        const totalSize = this.files.reduce((sum, file) => sum + file.sizeBytes, 0);
        document.getElementById('totalSize').textContent = this.formatFileSize(totalSize);
        
        document.getElementById('processedFiles').textContent = 
            this.files.filter(f => f.status === 'completed').length;
    }

    selectModel(card) {
        document.querySelectorAll('.model-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedModel = card.dataset.model;
        
        this.modelLoaded = false;
        document.getElementById('startAnalysis').disabled = true;
    }

    async loadModel() {
        const loadBtn = document.getElementById('loadModel');
        loadBtn.disabled = true;
        loadBtn.innerHTML = '<span class="loading-spinner">⚡</span> Loading Model...';

        try {
            await this.simulateModelLoading();
            
            this.modelLoaded = true;
            loadBtn.innerHTML = '✅ Model Loaded';
            loadBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            
            if (this.files.length > 0) {
                document.getElementById('startAnalysis').disabled = false;
            }
            
            this.showNotification(`${this.getModelName()} model loaded successfully!`, 'success');
        } catch (error) {
            loadBtn.disabled = false;
            loadBtn.innerHTML = 'Load Model';
            this.showNotification('Error loading model: ' + error.message, 'error');
        }
    }

    getModelName() {
        const names = {
            'swin': 'SWIN Transformer',
            'sae': 'SAE (Matryoshka)',
            'vit': 'Vision Transformer'
        };
        return names[this.selectedModel] || 'Unknown Model';
    }

    async simulateModelLoading() {
        return new Promise((resolve) => {
            setTimeout(resolve, 2000);
        });
    }

    async startAnalysis() {
        if (!this.modelLoaded) {
            this.showNotification('Please load a model first!', 'error');
            return;
        }

        this.isProcessing = true;
        this.startTime = Date.now();
        
        document.getElementById('progressSection').style.display = 'block';
        document.getElementById('resultsSection').style.display = 'none';
        document.getElementById('startAnalysis').disabled = true;
        
        try {
            await this.runAnalysisPipeline();
            this.showResults();
            this.showNotification('Analysis completed successfully!', 'success');
        } catch (error) {
            this.showNotification('Analysis failed: ' + error.message, 'error');
        } finally {
            this.isProcessing = false;
            document.getElementById('startAnalysis').disabled = false;
        }
    }

    async runAnalysisPipeline() {
        const steps = [
            { name: 'Preprocessing images...', duration: 2000 },
            { name:{ name: 'Extracting patches...', duration: 3000 },
            { name: 'Running feature extraction...', duration: 4000 },
            { name: 'Performing segmentation...', duration: 3000 },
            { name: 'Generating classifications...', duration: 2000 },
            { name: 'Creating visualizations...', duration: 1500 }
        ];

        let totalProgress = 0;
        let patchCount = 0;

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            this.updateProgress(totalProgress, step.name, i + 1);
            
            const stepProgress = 100 / steps.length;
            const increment = stepProgress / 10;
            
            for (let j = 0; j < 10; j++) {
                await new Promise(resolve => setTimeout(resolve, step.duration / 10));
                totalProgress += increment;
                patchCount += Math.floor(Math.random() * 50) + 10;
                
                this.updateProgress(totalProgress, step.name, i + 1, patchCount);
            }
            
            if (i < this.files.length) {
                this.files[i].status = 'completed';
                this.processedFiles++;
                this.updateFileList();
                this.updateStats();
            }
        }

        this.totalPatches = patchCount;
        this.updateProgress(100, 'Analysis complete!', steps.length, patchCount);
    }

    updateProgress(percentage, text, step, patches = 0) {
        document.getElementById('progressFill').style.width = `${percentage}%`;
        document.getElementById('progressPercent').textContent = `${Math.round(percentage)}%`;
        document.getElementById('progressText').textContent = text;
        document.getElementById('currentStep').textContent = step;
        document.getElementById('patchesProcessed').textContent = patches;
        
        if (this.startTime) {
            const elapsed = Math.round((Date.now() - this.startTime) / 1000);
            document.getElementById('timeElapsed').textContent = `${elapsed}s`;
            
            if (percentage > 0) {
                const eta = Math.round((elapsed / percentage) * (100 - percentage));
                document.getElementById('estimatedTime').textContent = `${eta}s`;
            }
        }
    }

    showResults() {
        document.getElementById('resultsSection').style.display = 'block';
        
        setTimeout(() => {
            this.createFeatureVisualization();
            this.createSegmentationResults();
            this.createClassificationReport();
            this.createAttentionMaps();
        }, 200);
    }

    createFeatureVisualization() {
        const container = document.getElementById('featureViz');
        container.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <div style="font-size: 1.2em; margin-bottom: 15px;">🎯 Feature Space Visualization</div>
                <div style="color: #6b7280; margin-bottom: 20px;">
                    ${this.totalPatches} patches embedded using ${this.getModelName()}
                </div>
                <div style="display: flex; gap: 10px; justify-content: center; margin-bottom: 15px; flex-wrap: wrap;">
                    <button class="btn btn-small" onclick="portal.switchVisualizationMethod('tsne')">t-SNE</button>
                    <button class="btn btn-small" onclick="portal.switchVisualizationMethod('pca')">PCA</button>
                    <button class="btn btn-small" onclick="portal.switchVisualizationMethod('umap')">UMAP</button>
                </div>
                <div style="position: relative; display: inline-block;">
                    <canvas id="featureCanvas" width="400" height="400" style="border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); cursor: crosshair;"></canvas>
                    <div id="featureInfo" style="margin-top: 10px; font-size: 0.9em; color: #6b7280;">
                        Hover over points to see details
                    </div>
                </div>
                <div style="margin-top: 15px; padding: 15px; background: #f3f4f6; border-radius: 8px;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 15px; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <div style="width: 12px; height: 12px; background: #ef4444; border-radius: 50%;"></div>
                            <span style="font-size: 0.85em;">Tumor Regions</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <div style="width: 12px; height: 12px; background: #10b981; border-radius: 50%;"></div>
                            <span style="font-size: 0.85em;">Normal Tissue</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <div style="width: 12px; height: 12px; background: #3b82f6; border-radius: 50%;"></div>
                            <span style="font-size: 0.85em;">Stromal Areas</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <div style="width: 12px; height: 12px; background: #f59e0b; border-radius: 50%;"></div>
                            <span style="font-size: 0.85em;">Inflammatory</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <div style="width: 12px; height: 12px; background: #8b5cf6; border-radius: 50%;"></div>
                            <span style="font-size: 0.85em;">Necrotic</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        setTimeout(() => this.renderFeatureVisualization('tsne'), 100);
    }

    switchVisualizationMethod(method) {
        document.querySelectorAll('#featureViz .btn-small').forEach(btn => {
            btn.style.background = 'linear-gradient(135deg, #64748b, #475569)';
            btn.style.color = 'white';
        });
        
        const buttons = document.querySelectorAll('#featureViz .btn-small');
        const methodIndex = ['tsne', 'pca', 'umap'].indexOf(method);
        if (buttons[methodIndex]) {
            buttons[methodIndex].style.background = 'linear-gradient(135deg, #6366f1, #8b5cf6)';
            buttons[methodIndex].style.color = 'white';
        }
        
        this.renderFeatureVisualization(method);
    }

    renderFeatureVisualization(method = 'tsne') {
        const canvas = document.getElementById('featureCanvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const padding = 40;
        
        ctx.clearRect(0, 0, width, height);
        
        const numPoints = Math.min(this.totalPatches, 500);
        const points = this.generateFeaturePoints(numPoints, method);
        
        this.drawAxes(ctx, width, height, padding);
        
        points.forEach((point, index) => {
            const x = padding + (point.x + 1) * (width - 2 * padding) / 2;
            const y = padding + (1 - point.y) * (height - 2 * padding) / 2;
            
            ctx.beginPath();
            ctx.arc(x, y, point.size, 0, 2 * Math.PI);
            ctx.fillStyle = point.color;
            ctx.fill();
            
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            point.screenX = x;
            point.screenY = y;
            point.index = index;
        });
        
        this.currentPoints = points;
        
        canvas.onmousemove = (e) => this.handleFeatureHover(e, canvas);
        canvas.onmouseleave = () => this.clearFeatureInfo();
    }

    generateFeaturePoints(numPoints, method) {
        const points = [];
        const colors = ['#ef4444', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'];
        const labels = ['Tumor', 'Normal', 'Stromal', 'Inflammatory', 'Necrotic'];
        
        for (let i = 0; i < numPoints; i++) {
            const clusterIndex = Math.floor(Math.random() * colors.length);
            const cluster = this.getTSNEClusterCenter(clusterIndex);
            
            const angle = Math.random() * 2 * Math.PI;
            const radius = Math.random() * 0.15 + Math.random() * 0.1;
            
            points.push({
                x: Math.max(-1, Math.min(1, cluster.x + Math.cos(angle) * radius)),
                y: Math.max(-1, Math.min(1, cluster.y + Math.sin(angle) * radius)),
                color: colors[clusterIndex],
                label: labels[clusterIndex],
                size: 3 + Math.random() * 2,
                confidence: 0.7 + Math.random() * 0.3,
                patchId: `patch_${i}`
            });
        }
        
        return points;
    }

    getTSNEClusterCenter(clusterIndex) {
        const centers = [
            { x: -0.6, y: 0.5 },
            { x: 0.6, y: 0.5 },
            { x: 0, y: -0.6 },
            { x: -0.4, y: -0.3 },
            { x: 0.4, y: -0.3 }
        ];
        return centers[clusterIndex] || centers[0];
    }

    drawAxes(ctx, width, height, padding) {
        ctx.strokeStyle = '#d1d5db';
        ctx.lineWidth = 1;
        
        ctx.beginPath();
        ctx.moveTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding);
        ctx.stroke();
        
        ctx.fillStyle = '#6b7280';
        ctx.font = '12px Inter, sans-serif';
        ctx.textAlign = 'center';
        
        ctx.fillText('Component 1', width / 2, height - 10);
        
        ctx.save();
        ctx.translate(15, height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Component 2', 0, 0);
        ctx.restore();
    }

    handleFeatureHover(event, canvas) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        
        let hoveredPoint = null;
        let minDistance = Infinity;
        
        if (this.currentPoints) {
            this.currentPoints.forEach(point => {
                const distance = Math.sqrt(
                    (mouseX - point.screenX) ** 2 + 
                    (mouseY - point.screenY) ** 2
                );
                
                if (distance < 10 && distance < minDistance) {
                    minDistance = distance;
                    hoveredPoint = point;
                }
            });
        }
        
        if (hoveredPoint) {
            canvas.style.cursor = 'pointer';
            this.showFeaturePointDetails(hoveredPoint);
        } else {
            canvas.style.cursor = 'crosshair';
            this.clearFeatureInfo();
        }
    }

    showFeaturePointDetails(point) {
        const infoDiv = document.getElementById('featureInfo');
        if (infoDiv) {
            infoDiv.innerHTML = `
                <strong>${point.patchId}</strong><br>
                <span style="color: ${point.color}; font-weight: bold;">●</span> ${point.label}<br>
                Confidence: ${(point.confidence * 100).toFixed(1)}%<br>
                Position: (${point.x.toFixed(3)}, ${point.y.toFixed(3)})
            `;
        }
    }

    clearFeatureInfo() {
        const infoDiv = document.getElementById('featureInfo');
        if (infoDiv) {
            infoDiv.textContent = 'Hover over points to see details';
        }
    }

    createSegmentationResults() {
        const container = document.getElementById('segmentationViz');
        const method = document.getElementById('segmentationMethod').value;
        const confidence = document.getElementById('confidenceThreshold').value;
        const detectedRegions = Math.floor(Math.random() * 400) + 150;
        
        container.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <div style="font-size: 1.2em; margin-bottom: 15px;">🔍 ${method.toUpperCase()} Segmentation</div>
                <div style="color: #6b7280; margin-bottom: 20px;">
                    Detected ${detectedRegions} regions of interest
                </div>
                <div style="display: flex; gap: 10px; justify-content: center; margin-bottom: 15px; flex-wrap: wrap;">
                    <button class="btn btn-small" onclick="portal.switchSegmentationView('overlay')">Overlay View</button>
                    <button class="btn btn-small" onclick="portal.switchSegmentationView('mask')">Mask View</button>
                    <button class="btn btn-small" onclick="portal.switchSegmentationView('contours')">Contours</button>
                </div>
                <div style="position: relative; display: inline-block;">
                    <canvas id="segmentationCanvas" width="400" height="400" style="border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); cursor: crosshair;"></canvas>
                    <div id="segmentationInfo" style="margin-top: 10px; font-size: 0.9em; color: #6b7280;">
                        Hover over regions to see details
                    </div>
                </div>
                <div style="margin-top: 15px; padding: 15px; background: #f3f4f6; border-radius: 8px;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 15px; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <div style="width: 12px; height: 12px; background: rgba(239, 68, 68, 0.7); border-radius: 50%;"></div>
                            <span style="font-size: 0.85em;">Tumor (${Math.floor(detectedRegions * 0.25)})</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <div style="width: 12px; height: 12px; background: rgba(16, 185, 129, 0.7); border-radius: 50%;"></div>
                            <span style="font-size: 0.85em;">Normal (${Math.floor(detectedRegions * 0.45)})</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <div style="width: 12px; height: 12px; background: rgba(59, 130, 246, 0.7); border-radius: 50%;"></div>
                            <span style="font-size: 0.85em;">Stroma (${Math.floor(detectedRegions * 0.20)})</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <div style="width: 12px; height: 12px; background: rgba(245, 158, 11, 0.7); border-radius: 50%;"></div>
                            <span style="font-size: 0.85em;">Other (${Math.floor(detectedRegions * 0.10)})</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        setTimeout(() => {
            console.log('Rendering segmentation visualization...');
            this.renderSegmentationVisualization('overlay');
        }, 500);
    }

    switchSegmentationView(viewType) {
        document.querySelectorAll('#segmentationViz .btn-small').forEach(btn => {
            btn.style.background = 'linear-gradient(135deg, #64748b, #475569)';
            btn.style.color = 'white';
        });
        
        const buttons = document.querySelectorAll('#segmentationViz .btn-small');
        const viewIndex = ['overlay', 'mask', 'contours'].indexOf(viewType);
        if (buttons[viewIndex]) {
            buttons[viewIndex].style.background = 'linear-gradient(135deg, #6366f1, #8b5cf6)';
            buttons[viewIndex].style.color = 'white';
        }
        
        this.renderSegmentationVisualization(viewType);
    }

    renderSegmentationVisualization(viewType = 'overlay') {
        const canvas = document.getElementById('segmentationCanvas');
        console.log('Attempting to render segmentation, canvas found:', !!canvas);
        
        if (!canvas) {
            console.error('Segmentation canvas not found!');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        console.log(`Rendering segmentation: ${viewType}, canvas size: ${width}x${height}`);
        
        ctx.clearRect(0, 0, width, height);
        
        this.drawTissueBackground(ctx, width, height);
        
        const regions = this.generateSegmentationRegions(width, height);
        console.log(`Generated ${regions.length} regions`);
        
        switch (viewType) {
            case 'overlay':
                this.drawSegmentationOverlay(ctx, regions);
                break;
            case 'mask':
                this.drawSegmentationMasks(ctx, regions, width, height);
                break;
            case 'contours':
                this.drawSegmentationContours(ctx, regions);
                break;
        }
        
        this.currentSegmentationRegions = regions;
        
        canvas.onmousemove = (e) => this.handleSegmentationHover(e, canvas);
        canvas.onmouseleave = () => this.clearSegmentationInfo();
        
        console.log('Segmentation rendering complete');
    }

    drawTissueBackground(ctx, width, height) {
        const gradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width/2);
        gradient.addColorStop(0, '#fdf2f8');
        gradient.addColorStop(0.5, '#fce7f3');
        gradient.addColorStop(1, '#f3e8ff');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        ctx.fillStyle = 'rgba(219, 39, 119, 0.1)';
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const radius = Math.random() * 8 + 2;
            
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            ctx.fill();
        }
        
        ctx.strokeStyle = 'rgba(147, 51, 234, 0.2)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 20; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const radius = Math.random() * 15 + 5;
            
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            ctx.stroke();
        }
    }

    generateSegmentationRegions(width, height) {
        const regions = [];
        const tissueTypes = [
            { type: 'tumor', color: 'rgba(239, 68, 68, 0.7)', probability: 0.25 },
            { type: 'normal', color: 'rgba(16, 185, 129, 0.7)', probability: 0.45 },
            { type: 'stroma', color: 'rgba(59, 130, 246, 0.7)', probability: 0.20 },
            { type: 'other', color: 'rgba(245, 158, 11, 0.7)', probability: 0.10 }
        ];
        
        const numRegions = Math.floor(Math.random() * 40) + 30;
        
        for (let i = 0; i < numRegions; i++) {
            let cumulativeProb = 0;
            let selectedType = tissueTypes[0];
            const rand = Math.random();
            
            for (const tissueType of tissueTypes) {
                cumulativeProb += tissueType.probability;
                if (rand <= cumulativeProb) {
                    selectedType = tissueType;
                    break;
                }
            }
            
            const centerX = Math.random() * (width - 60) + 30;
            const centerY = Math.random() * (height - 60) + 30;
            const baseRadius = Math.random() * 25 + 10;
            
            const numPoints = Math.floor(Math.random() * 4) + 6;
            const points = [];
            
            for (let j = 0; j < numPoints; j++) {
                const angle = (j / numPoints) * 2 * Math.PI;
                const radiusVariation = 0.7 + Math.random() * 0.6;
                const pointRadius = baseRadius * radiusVariation;
                
                points.push({
                    x: centerX + Math.cos(angle) * pointRadius,
                    y: centerY + Math.sin(angle) * pointRadius
                });
            }
            
            regions.push({
                id: `region_${i}`,
                type: selectedType.type,
                color: selectedType.color,
                points: points,
                center: { x: centerX, y: centerY },
                area: Math.PI * baseRadius * baseRadius,
                confidence: 0.7 + Math.random() * 0.3
            });
        }
        
        return regions;
    }

    drawSegmentationOverlay(ctx, regions) {
        regions.forEach(region => {
            ctx.beginPath();
            ctx.moveTo(region.points[0].x, region.points[0].y);
            
            for (let i = 1; i < region.points.length; i++) {
                ctx.lineTo(region.points[i].x, region.points[i].y);
            }
            
            ctx.closePath();
            ctx.fillStyle = region.color;
            ctx.fill();
            
            ctx.strokeStyle = region.color.replace('0.7', '1.0');
            ctx.lineWidth = 2;
            ctx.stroke();
        });
    }

    drawSegmentationMasks(ctx, regions, width, height) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
        
        regions.forEach((region, index) => {
            ctx.beginPath();
            ctx.moveTo(region.points[0].x, region.points[0].y);
            
            for (let i = 1; i < region.points.length; i++) {
                ctx.lineTo(region.points[i].x, region.points[i].y);
            }
            
            ctx.closePath();
            
            const maskColors = {
                'tumor': '#ff4444',
                'normal': '#44ff44', 
                'stroma': '#4444ff',
                'other': '#ffaa44'
            };
            
            ctx.fillStyle = maskColors[region.type] || '#ffffff';
            ctx.fill();
        });
    }

    drawSegmentationContours(ctx, regions) {
        regions.forEach(region => {
            ctx.beginPath();
            ctx.moveTo(region.points[0].x, region.points[0].y);
            
            for (let i = 1; i < region.points.length; i++) {
                ctx.lineTo(region.points[i].x, region.points[i].y);
            }
            
            ctx.closePath();
            
            ctx.strokeStyle = region.color.replace('0.7', '1.0');
            ctx.lineWidth = 3;
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(region.center.x, region.center.y, 3, 0, 2 * Math.PI);
            ctx.fillStyle = region.color.replace('0.7', '1.0');
            ctx.fill();
        });
    }

    handleSegmentationHover(event, canvas) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        
        let hoveredRegion = null;
        
        if (this.currentSegmentationRegions) {
            this.currentSegmentationRegions.forEach(region => {
                if (this.isPointInPolygon(mouseX, mouseY, region.points)) {
                    hoveredRegion = region;
                }
            });
        }
        
        if (hoveredRegion) {
            canvas.style.cursor = 'pointer';
            this.showSegmentationDetails(hoveredRegion);
        } else {
            canvas.style.cursor = 'crosshair';
            this.clearSegmentationInfo();
        }
    }

    isPointInPolygon(x, y, points) {
        let inside = false;
        
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            if (((points[i].y > y) !== (points[j].y > y)) &&
                (x < (points[j].x - points[i].x) * (y - points[i].y) / (points[j].y - points[i].y) + points[i].x)) {
                inside = !inside;
            }
        }
        
        return inside;
    }

    showSegmentationDetails(region) {
        const infoDiv = document.getElementById('segmentationInfo');
        if (infoDiv) {
            const area = Math.round(region.area);
            const confidence = (region.confidence * 100).toFixed(1);
            
            infoDiv.innerHTML = `
                <strong>${region.id}</strong><br>
                <span style="color: ${region.color.replace('0.7', '1.0')}; font-weight: bold;">●</span> ${region.type.toUpperCase()}<br>
                Area: ${area} px² | Confidence: ${confidence}%
            `;
        }
    }

    clearSegmentationInfo() {
        const infoDiv = document.getElementById('segmentationInfo');
        if (infoDiv) {
            infoDiv.textContent = 'Hover over regions to see details';
        }
    }

    createClassificationReport() {
        const container = document.getElementById('classificationReport');
        container.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <div style="font-size: 1.2em; margin-bottom: 15px;">📈 Classification Results</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px;">
                    <div style="background: #f3f4f6; padding: 15px; border-radius: 8px;">
                        <strong>Accuracy</strong><br>
                        <span style="font-size: 1.5em; color: #10b981;">94.2%</span>
                    </div>
                    <div style="background: #f3f4f6; padding: 15px; border-radius: 8px;">
                        <strong>F1-Score</strong><br>
                        <span style="font-size: 1.5em; color: #3b82f6;">0.91</span>
                    </div>
                </div>
            </div>
        `;
    }

    createAttentionMaps() {
        const container = document.getElementById('attentionMaps');
        container.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <div style="font-size: 1.2em; margin-bottom: 15px;">🗺️ Attention Visualization</div>
                <div style="color: #6b7280; margin-bottom: 20px;">
                    ${this.getModelName()} attention heads analysis
                </div>
                <div style="display: flex; gap: 10px; justify-content: center; margin-bottom: 15px; flex-wrap: wrap;">
                    <button class="btn btn-small" onclick="portal.switchAttentionHead(0)">Head 1</button>
                    <button class="btn btn-small" onclick="portal.switchAttentionHead(1)">Head 2</button>
                    <button class="btn btn-small" onclick="portal.switchAttentionHead(2)">Head 3</button>
                    <button class="btn btn-small" onclick="portal.switchAttentionHead(3)">Head 4</button>
                </div>
                <div style="position: relative; display: inline-block;">
                    <canvas id="attentionCanvas" width="300" height="300" style="border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);"></canvas>
                    <div id="attentionInfo" style="margin-top: 10px; font-size: 0.9em; color: #6b7280;">
                        Click on the heatmap to see attention weights
                    </div>
                </div>
                <div style="margin-top: 15px; padding: 15px; background: #f3f4f6; border-radius: 8px;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 20px;">
                        <div style="display: flex; align-items: center;<div style="display: flex; align-items: center; gap: 5px;">
                            <div style="width: 20px; height: 12px; background: linear-gradient(to right, #3b82f6, #1d4ed8); border-radius: 2px;"></div>
                            <span style="font-size: 0.85em;">Low Attention</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <div style="width: 20px; height: 12px; background: linear-gradient(to right, #f59e0b, #dc2626); border-radius: 2px;"></div>
                            <span style="font-size: 0.85em;">High Attention</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        setTimeout(() => this.renderAttentionMap(0), 100);
    }

    switchAttentionHead(headIndex) {
        document.querySelectorAll('#attentionMaps .btn-small').forEach((btn, index) => {
            if (index === headIndex) {
                btn.style.background = 'linear-gradient(135deg, #6366f1, #8b5cf6)';
                btn.style.color = 'white';
            } else {
                btn.style.background = 'linear-gradient(135deg, #64748b, #475569)';
                btn.style.color = 'white';
            }
        });
        
        this.renderAttentionMap(headIndex);
    }

    renderAttentionMap(headIndex) {
        const canvas = document.getElementById('attentionCanvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        ctx.clearRect(0, 0, width, height);
        
        const gridSize = 20;
        const cellWidth = width / gridSize;
        const cellHeight = height / gridSize;
        
        const attentionPatterns = [
            () => this.generateCenterFocusAttention(gridSize),
            () => this.generateEdgeDetectionAttention(gridSize),
            () => this.generateTextureAttention(gridSize),
            () => this.generateRandomAttention(gridSize)
        ];
        
        const attentionMatrix = attentionPatterns[headIndex]();
        
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const attention = attentionMatrix[i][j];
                const color = this.attentionToColor(attention);
                
                ctx.fillStyle = color;
                ctx.fillRect(j * cellWidth, i * cellHeight, cellWidth, cellHeight);
                
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(j * cellWidth, i * cellHeight, cellWidth, cellHeight);
            }
        }
        
        canvas.onclick = (e) => this.showAttentionDetails(e, canvas, attentionMatrix, gridSize);
        
        const infoDiv = document.getElementById('attentionInfo');
        const headNames = ['Center Focus', 'Edge Detection', 'Texture Analysis', 'Global Context'];
        if (infoDiv) {
            infoDiv.textContent = `Attention Head ${headIndex + 1}: ${headNames[headIndex]} - Click to explore`;
        }
    }

    generateCenterFocusAttention(size) {
        const matrix = [];
        const center = size / 2;
        
        for (let i = 0; i < size; i++) {
            matrix[i] = [];
            for (let j = 0; j < size; j++) {
                const dist = Math.sqrt((i - center) ** 2 + (j - center) ** 2);
                const maxDist = Math.sqrt(2 * (center ** 2));
                matrix[i][j] = Math.max(0.1, 1 - (dist / maxDist)) + Math.random() * 0.2;
            }
        }
        return matrix;
    }

    generateEdgeDetectionAttention(size) {
        const matrix = [];
        
        for (let i = 0; i < size; i++) {
            matrix[i] = [];
            for (let j = 0; j < size; j++) {
                const edgeProximity = Math.min(i, j, size - 1 - i, size - 1 - j);
                const edgeWeight = edgeProximity < 3 ? 0.8 : 0.2;
                
                const diagonalPattern = Math.abs(i - j) < 2 || Math.abs(i + j - size) < 2 ? 0.6 : 0;
                
                matrix[i][j] = Math.max(0.1, edgeWeight + diagonalPattern + Math.random() * 0.3);
            }
        }
        return matrix;
    }

    generateTextureAttention(size) {
        const matrix = [];
        
        for (let i = 0; i < size; i++) {
            matrix[i] = [];
            for (let j = 0; j < size; j++) {
                const checkerboard = ((Math.floor(i / 2) + Math.floor(j / 2)) % 2) * 0.5;
                
                const wave = Math.sin(i * 0.5) * Math.cos(j * 0.5) * 0.3;
                
                matrix[i][j] = Math.max(0.1, 0.4 + checkerboard + wave + Math.random() * 0.3);
            }
        }
        return matrix;
    }

    generateRandomAttention(size) {
        const matrix = [];
        
        for (let i = 0; i < size; i++) {
            matrix[i] = [];
            for (let j = 0; j < size; j++) {
                let attention = Math.random();
                
                if (i > 0 && j > 0 && matrix[i-1][j-1] > 0.7) {
                    attention = Math.max(attention, 0.6 + Math.random() * 0.3);
                }
                
                matrix[i][j] = attention;
            }
        }
        return matrix;
    }

    attentionToColor(attention) {
        const normalized = Math.min(1, Math.max(0, attention));
        
        if (normalized < 0.5) {
            const t = normalized * 2;
            const r = Math.floor(59 + (255 - 59) * t);
            const g = Math.floor(130 + (255 - 130) * t);
            const b = Math.floor(246 - 246 * t);
            return `rgb(${r}, ${g}, ${b})`;
        } else {
            const t = (normalized - 0.5) * 2;
            const r = Math.floor(255);
            const g = Math.floor(255 - 155 * t);
            const b = Math.floor(0);
            return `rgb(${r}, ${g}, ${b})`;
        }
    }

    showAttentionDetails(event, canvas, matrix, gridSize) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const cellWidth = canvas.width / gridSize;
        const cellHeight = canvas.height / gridSize;
        
        const gridX = Math.floor(x / cellWidth);
        const gridY = Math.floor(y / cellHeight);
        
        if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
            const attention = matrix[gridY][gridX];
            const percentage = (attention * 100).toFixed(1);
            
            const infoDiv = document.getElementById('attentionInfo');
            if (infoDiv) {
                infoDiv.innerHTML = `
                    <strong>Position (${gridX}, ${gridY})</strong><br>
                    Attention Weight: ${percentage}%<br>
                    <span style="color: ${this.attentionToColor(attention)}; font-weight: bold;">●</span> ${this.getAttentionDescription(attention)}
                `;
            }
        }
    }

    getAttentionDescription(attention) {
        if (attention > 0.8) return "Very High Focus";
        if (attention > 0.6) return "High Focus";
        if (attention > 0.4) return "Moderate Focus";
        if (attention > 0.2) return "Low Focus";
        return "Minimal Focus";
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => notification.classList.add('show'), 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const portal = new WSIPortal();
    window.portal = portal;
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.notification').forEach(notification => {
                notification.classList.remove('show');
            });
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            if (!portal.isProcessing && portal.files.length > 0 && portal.modelLoaded) {
                portal.startAnalysis();
            }
        }
    });
    
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());
    
    console.log('🚀 WSI Portal ready for analysis!');
});

window.addEventListener('error', (e) => {
    console.error('WSI Portal Error:', e.error);
    if (window.portal) {
        window.portal.showNotification('An unexpected error occurred. Please refresh the page.', 'error');
    }
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled Promise Rejection:', e.reason);
    if (window.portal) {
        window.portal.showNotification('A processing error occurred. Please try again.', 'error');
    }
});

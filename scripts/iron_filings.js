var irnSettings = {
	
	filingsCountSQRT:300,
	filingsSpeed:0.002,
	filingsParticleSize:2.0,

	magnetFieldResolution:1024,
	maxMagnets:20,

	fieldLinesCountSQRT:15,
	fieldLineSpace:0.01,
	fieldLinesSize:30,
	
}

var irnGlobals = {
	WIDTH:700,
	HEIGHT:700,
	renderer:null,
	stats:null,
	preCompute:null,
	gpuCompute:null,

	magnets:[],
	posMagnets:[],
	randomFilings:[],
	currentMagnet:0,

	magnetComputePass:null,
	fieldLineRenderPass:null,
	fieldLinesIntegrationPass:null,
	filingsIntegrationPass:null,
	filingsRenderPass:null

}

window.onload=function(){

	init();
	animate();

};

function init() {

	for(var i = 0; i < irnSettings.maxMagnets; ++i){
		irnGlobals.magnets[i] = new THREE.Vector4(-1.0,-1.0,-1.0,-1.0);
		irnGlobals.posMagnets[i] = new THREE.Vector4(-1.0,-1.0,-1.0,-1.0);
	}

	irnGlobals.renderer = new THREE.WebGLRenderer({preserveDrawingBuffer:true});
	irnGlobals.renderer.setPixelRatio( window.devicePixelRatio );
	irnGlobals.renderer.setSize( irnGlobals.WIDTH, irnGlobals.HEIGHT );
	irnGlobals.renderer.setClearColor( 0xffffff );
	var container = document.getElementById( 'container' );
	container.appendChild( irnGlobals.renderer.domElement );


	//Set up gpu computing passes
	irnGlobals.preCompute = new GPUComputeProgram(irnGlobals.renderer);
	irnGlobals.gpuCompute = new GPUComputeProgram(irnGlobals.renderer);

	irnGlobals.magnetComputePass = createMagnetComputePass();

	irnGlobals.fieldLinesIntegrationPass = createFieldLineIntegrationPass(irnGlobals.magnetComputePass);
	irnGlobals.preCompute.addPass(irnGlobals.fieldLinesIntegrationPass);

	irnGlobals.fieldLineRenderPass = createFieldLineRenderPass(irnGlobals.fieldLinesIntegrationPass, irnGlobals.magnetComputePass);
	irnGlobals.preCompute.addPass(irnGlobals.fieldLineRenderPass);

	irnGlobals.filingsIntegrationPass = createFilingsIntegrationPass(irnGlobals.magnetComputePass, irnGlobals.fieldLineRenderPass);
	irnGlobals.gpuCompute.addPass(irnGlobals.filingsIntegrationPass);

	irnGlobals.filingsRenderPass = createFilingsRenderPass(irnGlobals.filingsIntegrationPass);
	irnGlobals.gpuCompute.addPass(irnGlobals.filingsRenderPass);

	irnGlobals.filingsIntegrationPass.shaderMaterial.uniforms.renderedFilings.value = irnGlobals.filingsRenderPass.getOutputTexture();

	//var outputPass = createTestOutputPass(irnGlobals.fieldLineRenderPass);
	var outputPass = createTestOutputPass(irnGlobals.filingsRenderPass);
	irnGlobals.gpuCompute.addPass(outputPass);

	


	irnGlobals.stats = new Stats();
	irnGlobals.stats.domElement.style.position = 'absolute';
	irnGlobals.stats.domElement.style.top = '0px';
	container.appendChild( irnGlobals.stats.domElement );


	//window.addEventListener( 'resize', onWindowResize, false );

	irnGlobals.renderer.domElement.addEventListener( 'mousedown', onDocumentMouseDown, false );
	irnGlobals.renderer.domElement.addEventListener( 'mousemove', onDocumentMouseMove, false );
	irnGlobals.renderer.domElement.addEventListener( 'mouseup', onDocumentMouseUp, false );

	// irnGlobals.renderer.domElement.addEventListener( 'touchstart', onDocumentMouseDown, false );
	// irnGlobals.renderer.domElement.addEventListener( 'touchmove', onDocumentMouseMove, false );
	// irnGlobals.renderer.domElement.addEventListener( 'touchend', onDocumentMouseUp, false );
}



function createMagnetComputePass(i_shader){

	var mag_Uniforms = {

		magnets: { type: "v4v", value:irnGlobals.magnets },

	};

	var mag_shaderMaterial = new THREE.ShaderMaterial( {

		uniforms:       mag_Uniforms,
		vertexShader:   SHADER.VertexPassThrough,
		fragmentShader: '#define MAX_MAGNETS '+ irnSettings.maxMagnets + '\n' + SHADER.FragmentMagneticFieldCompute,

		blending:       THREE.NormalBlending,
		depthTest:      false,
		transparent:    false

	});


	var magComp = new ComputePass({x: irnSettings.magnetFieldResolution, y: irnSettings.magnetFieldResolution}, mag_shaderMaterial, false, THREE.FloatType);
	return magComp;
}

function createFieldLineIntegrationPass(i_velocityPass){


	var positionUniforms = {

		fieldLineSpace: {type:"f", value:irnSettings.fieldLineSpace},
		velocities: {type:"t", value:i_velocityPass.getOutputTexture()},
		computedOutput: { type: "t", value:null }

	};

	var positionShaderMaterial = new THREE.ShaderMaterial( {

		uniforms:       positionUniforms,
		vertexShader:   SHADER.VertexPassThrough,
		fragmentShader: SHADER.FragmentFieldLineIntegration,

		blending:       THREE.NormalBlending,
		depthTest:      false,
		transparent:    false

	});

	var posPassData = [];
	var step = 1.0/irnSettings.fieldLinesCountSQRT;
	for(var i = 0; i < irnSettings.fieldLinesCountSQRT*irnSettings.fieldLinesCountSQRT; ++i){
		// posPassData.push((i%irnSettings.fieldLinesCountSQRT)*step); //--GRID
		// posPassData.push(Math.floor(i/irnSettings.fieldLinesCountSQRT)*step); //--GRID
		posPassData.push(0.0);
		posPassData.push(0.0);
		posPassData.push(0.0);
		posPassData.push(0.0);
	}

	var sze = {x: irnSettings.fieldLinesCountSQRT, y: irnSettings.fieldLinesCountSQRT};
	var posAdd = new ComputePass(sze, positionShaderMaterial, true, THREE.FloatType);
	posAdd.initData(irnSettings.fieldLinesCountSQRT, irnSettings.fieldLinesCountSQRT, posPassData);

	return posAdd;

}

function createFieldLineRenderPass(i_positionPass, i_magneticFields){
	
	output_scene = new THREE.Scene();
	output_camera = new THREE.OrthographicCamera(0, irnGlobals.WIDTH, irnGlobals.HEIGHT, 0, -10000, 10000);
	output_camera.position.z = 100;

	var fieldLineRender_uniforms = {

		particleSize: { type: "f", value: irnSettings.fieldLinesSize},
		viewSize: { type: "v2", value: new THREE.Vector2(irnGlobals.WIDTH, irnGlobals.HEIGHT)},
		textureSize: { type: "v2", value: new THREE.Vector2(irnSettings.fieldLinesCountSQRT, irnSettings.fieldLinesCountSQRT)},
		outputSize: { type: "v2", value: new THREE.Vector2(irnSettings.magnetFieldResolution, irnSettings.magnetFieldResolution)},
		positionTexture:   { type: "t", value: i_positionPass.getOutputTexture() },
		magneticField:   { type: "t", value: i_magneticFields.getOutputTexture() },
		computedOutput:   { type: "t", value: null },

//		colorTexture:   { type: "t", value: marble_texture }

	};

	var output_shaderMaterial = new THREE.ShaderMaterial( {

		uniforms:       fieldLineRender_uniforms,
		vertexShader:   SHADER.VertexPositionFromTexture,
		fragmentShader: SHADER.FragmentFieldLineAttraction,

		blending:       THREE.NormalBlending,
		depthTest:      false,
		transparent:    true

	});
	

	var output_geometry = new THREE.Geometry();
	for(var i = 0; i < irnSettings.fieldLinesCountSQRT * irnSettings.fieldLinesCountSQRT; ++i){
		output_geometry.vertices.push(new THREE.Vector3( i%irnSettings.fieldLinesCountSQRT,  Math.floor(i/irnSettings.fieldLinesCountSQRT), 0 )); 
	}

	var particleSystem = new THREE.Points( output_geometry, output_shaderMaterial );
	output_scene.add( particleSystem );

	var buffSize = {x:irnSettings.magnetFieldResolution, y:irnSettings.magnetFieldResolution};
	var feildLineRenderPass = new ComputePass(buffSize, output_shaderMaterial, true, THREE.FloatType, output_scene, output_camera);
	feildLineRenderPass.setUpdateFunction(function(){
		fieldLineRender_uniforms.positionTexture.value = i_positionPass.getOutputTexture();
	});

	feildLineRenderPass.autoClear = false;


	return feildLineRenderPass;

}

function createFilingsIntegrationPass(i_magneticFields, i_fieldLines){


	var positionUniforms = {

		speed: {type:"f", value:irnSettings.filingsSpeed},
		particleSize:{type:"f", value:irnSettings.filingsParticleSize},
		renderedFilingsSize: {type:"v2", value:new THREE.Vector2(irnGlobals.WIDTH, irnGlobals.HEIGHT)},
		magneticField: {type:"t", value:i_magneticFields.getOutputTexture()},
		fieldLines: {type:"t", value:i_fieldLines.getOutputTexture()},
		computedOutput: { type: "t", value:null },
		renderedFilings: { type: "t", value:null }

	};

	var positionShaderMaterial = new THREE.ShaderMaterial( {

		uniforms:       positionUniforms,
		vertexShader:   SHADER.VertexPassThrough,
		fragmentShader: SHADER.FragmentFilingsIntegration,

		blending:       THREE.NormalBlending,
		depthTest:      false,
		transparent:    false

	});

	irnGlobals.randomFilings = [];
	var step = 1.0/irnSettings.filingsCountSQRT;
	for(var i = 0; i < irnSettings.filingsCountSQRT*irnSettings.filingsCountSQRT; ++i){
		// posPassData.push((i%irnSettings.filingsCountSQRT)*step); //--GRID
		// posPassData.push(Math.floor(i/irnSettings.filingsCountSQRT)*step); //--GRID
		irnGlobals.randomFilings.push(Math.random());
		irnGlobals.randomFilings.push(Math.random());
		irnGlobals.randomFilings.push(0.0);
		irnGlobals.randomFilings.push(1.0);
	}

	var sze = {x: irnSettings.filingsCountSQRT, y: irnSettings.filingsCountSQRT};
	var posAdd = new ComputePass(sze, positionShaderMaterial, true, THREE.FloatType);
	posAdd.initData(irnSettings.filingsCountSQRT, irnSettings.filingsCountSQRT, irnGlobals.randomFilings);

	posAdd.setUpdateFunction(function(){
		positionUniforms.magneticField.value = i_magneticFields.getOutputTexture();
		positionUniforms.fieldLines.value = i_fieldLines.getOutputTexture();
		positionUniforms.renderedFilings.value = irnGlobals.filingsRenderPass.getOutputTexture();
	});


	return posAdd;

}

function createFilingsRenderPass(i_positionPass){
	
	output_scene = new THREE.Scene();
	output_camera = new THREE.OrthographicCamera(0, irnGlobals.WIDTH, irnGlobals.HEIGHT, 0, -10000, 10000);
	output_camera.position.z = 100;

	var filingsRender_uniforms = {

		particleSize: { type: "f", value: irnSettings.filingsParticleSize},
		viewSize: { type: "v2", value: new THREE.Vector2(irnGlobals.WIDTH, irnGlobals.HEIGHT)},
		textureSize: { type: "v2", value: new THREE.Vector2(irnSettings.filingsCountSQRT, irnSettings.filingsCountSQRT)},
		positionTexture:   { type: "t", value: i_positionPass.getOutputTexture() },
		computedOutput:   { type: "t", value: null }
	};

	var filingsRender_shaderMaterial = new THREE.ShaderMaterial( {

		uniforms:       filingsRender_uniforms,
		vertexShader:   SHADER.VertexPositionFromTexture,
		fragmentShader: SHADER.FragmentBlackPoint,

		blending:       THREE.NormalBlending,
		depthTest:      false,
		transparent:    true

	});
	

	var output_geometry = new THREE.Geometry();
	for(var i = 0; i < irnSettings.filingsCountSQRT * irnSettings.filingsCountSQRT; ++i){
		output_geometry.vertices.push(new THREE.Vector3( i%irnSettings.filingsCountSQRT,  Math.floor(i/irnSettings.filingsCountSQRT), 0 )); 
	}

	var particleSystem = new THREE.Points( output_geometry, filingsRender_shaderMaterial );
	output_scene.add( particleSystem );

	var buffSize = {x:irnGlobals.WIDTH, y:irnGlobals.HEIGHT};
	var filingsRenderPassOut = new ComputePass(buffSize, filingsRender_shaderMaterial, true, THREE.FloatType, output_scene, output_camera);
	filingsRenderPassOut.setUpdateFunction(function(){
		filingsRender_uniforms.positionTexture.value = i_positionPass.getOutputTexture();
	});

	filingsRenderPassOut.autoClear = true;

	return filingsRenderPassOut;

}

function createTestOutputPass(i_testPass){


	var testOutput_pass = new OutputTextureRect(i_testPass.getOutputTexture(), {x:i_testPass.size.x, y:i_testPass.size.y});

	testOutput_pass.setUpdateFunction(function(){
		testOutput_pass.material.map = i_testPass.getOutputTexture();
	});

	return testOutput_pass;

}

function createImagePlanePass(i_texture, i_size){
	var imgOutput_pass = new OutputTextureRect(i_texture, {x:i_size.x, y:i_size.y});
	return imgOutput_pass;
}

function currentMagnet(){
	
	var m = irnGlobals.currentMagnet;
	irnGlobals.currentMagnet = (irnGlobals.currentMagnet + 1)%irnSettings.maxMagnets;
	return m;

}

function onDocumentMouseDown( event ) {

		event.preventDefault();
		//var mP = getMousePos( irnGlobals.renderer.domElement, irnSettings.magnetFieldResolution, event );
		//irnGlobals.magnets[currentMagnet()] = new THREE.Vector4(mP.x, mP.y, -1.0, 1.0 );
		 
}

function onDocumentMouseUp( event ) {
		event.preventDefault();

		irnGlobals.filingsIntegrationPass.initData(irnSettings.filingsCountSQRT, irnSettings.filingsCountSQRT, irnGlobals.randomFilings);

		var mP = getMousePos( irnGlobals.renderer.domElement, irnSettings.magnetFieldResolution, event );
		var cM = currentMagnet();
		irnGlobals.magnets[cM] = new THREE.Vector4(mP.x, mP.y, cM%2==0? 1 : -1, 1.0 );
		//irnGlobals.posMagnets[cM] = irnGlobals.magnets[cM];


		var posPassData = [];
		var step = 1.0/irnSettings.fieldLinesCountSQRT;
		var countFromMagnets = Math.floor((3*(irnSettings.fieldLinesCountSQRT*irnSettings.fieldLinesCountSQRT))/4.0);
		var countFromEdge = Math.ceil((irnSettings.fieldLinesCountSQRT*irnSettings.fieldLinesCountSQRT)/4.0);
		var theta = Math.PI*2/(countFromMagnets/(cM+1));

		for(var i = 0; i < countFromMagnets; ++i){
			// posPassData.push((i%irnSettings.fieldLinesCountSQRT)*step); //--GRID
			// posPassData.push(Math.floor(i/irnSettings.fieldLinesCountSQRT)*step); //--GRID
			var cnt = Math.floor(i/(countFromMagnets/(cM+1.0)));
			var currMag = irnGlobals.magnets[cnt];
			posPassData.push(currMag.x+Math.cos(i*theta)*(15.36/irnSettings.magnetFieldResolution+0.025));
			posPassData.push(currMag.y+Math.sin(i*theta)*(15.36/irnSettings.magnetFieldResolution+0.025));
			//posPassData.push(currMag.x+Math.cos(Math.random()*6.2831854)*0.02);
			//posPassData.push(currMag.y+Math.sin(Math.random()*6.2831854)*0.02);
			posPassData.push(currMag.z);
			posPassData.push(1.0);
		}

		var theta = Math.PI*2/(countFromEdge);
		for(var i = 0; i < countFromEdge; ++i){
			// posPassData.push((i%irnSettings.fieldLinesCountSQRT)*step); //--GRID
			// posPassData.push(Math.floor(i/irnSettings.fieldLinesCountSQRT)*step); //--GRID
			
			posPassData.push(0.5+Math.cos(i*theta)*0.7071);
			posPassData.push(0.5+Math.sin(i*theta)*0.7071);
			//posPassData.push(currMag.x+Math.cos(Math.random()*6.2831854)*0.02);
			//posPassData.push(currMag.y+Math.sin(Math.random()*6.2831854)*0.02);
			posPassData.push(0.0);
			posPassData.push(1.0);
		}


		irnGlobals.renderer.setClearColor( 0x000000 );

		irnGlobals.fieldLinesIntegrationPass.initData(irnSettings.fieldLinesCountSQRT, irnSettings.fieldLinesCountSQRT, posPassData);

		irnGlobals.magnetComputePass.render(irnGlobals.renderer);
		irnGlobals.fieldLineRenderPass.clear(irnGlobals.renderer);

		// for(var i = 0; i < 1500; ++i){
		// 	irnGlobals.preCompute.render();
		// }

		irnGlobals.renderer.setClearColor( 0xffffff );

	}

function onDocumentMouseMove( event ) {
	
}

function interactAt(i_position, i_index){

}

function getMousePos(canvas, bufferSize, evt) {
	var rect = canvas.getBoundingClientRect();
	
	var w = (rect.right - rect.left);
  	var h = (rect.bottom - rect.top)
	return {
  		x: ((evt.clientX - rect.left)/w),
  		y: 1.0-((evt.clientY - rect.top)/h)
	};
}

function onWindowResize() {

	//output_camera.aspect = window.innerWidth / window.innerHeight;
	//output_camera.updateProjectionMatrix();

	//renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

	requestAnimationFrame( animate );
	render();
	

	irnGlobals.stats.update();


}

function render() {
	irnGlobals.gpuCompute.render();
}
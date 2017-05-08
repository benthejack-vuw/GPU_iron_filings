SHADER = {};

SHADER.VertexPassThrough = [

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv;",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" );

SHADER.FragmentBlackPoint = [

		"void main() {",

			"float a = distance(gl_PointCoord, vec2(0.5,0.5));",
			"a = a*2.0;",
			"a = clamp(a, 0.0, 1.0);",
			"if(a >= 0.9) discard;", 
			"gl_FragColor = vec4(a,a,a,1.5-a);",
			//"gl_FragColor = vec4(0.0,0.0,0.0,1.0);",


		"}"

].join( "\n" );

SHADER.FragmentFieldLineAttraction = [
	
	"uniform sampler2D computedOutput;",
	"uniform sampler2D magneticField;",
	"uniform vec2 outputSize;",

	"varying vec2 ptPos;",

	"void main() {",
		
		//d=(x−x1)(y2−y1)−(y−y1)(x2−x1)
		
		"float a = distance(gl_PointCoord, vec2(0.5,0.5));",
		"a = a > 0.5 ? 0.0 : a;",
		"if(a <= 0.0) discard;",


		"vec2 newPos = ptPos*0.5+0.25;",
		"vec2 dir = normalize(texture2D(magneticField, newPos).xy);",
		"vec2 perpDir = normalize(vec2(dir.y, -dir.x));",


		"vec2 pt = gl_PointCoord.xy;",
		"vec2 pt1 = vec2(0.5, 0.5);",
		"vec2 pt2 = vec2(dir.x, -dir.y) +0.5;",
		//"vec2 oldCol = texture2D(computedOutput, gl_FragCoord/outputSize).xy;",

		"float s = sign((pt.x - pt1.x) * (pt2.y - pt1.y) - (pt.y - pt1.y) * (pt2.x - pt1.x));",
		//"float loc = length(oldCol);",
		//"dir = loc < a && loc > 0.0001 ? oldCol : dir*-s;",
		//"dir = dir + oldCol;",
		
		"gl_FragColor = vec4(perpDir*s,0,1.0);",
		//"gl_FragColor = vec4(vec2(gl_FragCoord.x, outputSize.y-gl_FragCoord.y)/outputSize,0,1.0);",

	"}"

].join( "\n" );

SHADER.FragmentClearWithFloats = [

		"uniform vec4 clearColor;",

		"void main() {",

			"gl_FragColor = clearColor;",

		"}"

	].join( "\n" );


SHADER.FragmentFieldLineIntegration = [

		"uniform float fieldLineSpace;",
		"uniform sampler2D computedOutput;",
		"uniform sampler2D velocities;",
		"varying vec2 vUv;",


		"void main() {",

			"vec2 pos = texture2D(computedOutput, vUv).xy;",
			"vec2 velPos = pos*0.5 + 0.25;",
			"vec2 vel = texture2D(velocities, velPos).xy;",
			"vel = normalize(vel);",
			"pos.x += vel.x*fieldLineSpace;",
			"pos.y += vel.y*fieldLineSpace;",

			"gl_FragColor = vec4(pos, 0.0, 1.0);",
		"}"

	].join( "\n" );


SHADER.VertexPositionFromTexture = [
		
		"uniform float particleSize;",
		"uniform vec2 viewSize;",
		"uniform vec2 textureSize;",
		"uniform sampler2D positionTexture;",

		"varying vec2 ptPos;",

		"void main() {",

			"vec2 pixelStep = vec2(1.0/textureSize.x, 1.0/textureSize.y);",
			"vec2 texOffset = vec2(pixelStep.x/2.0, pixelStep.y/2.0);",
			"vec4 texPosition = texture2D(positionTexture, position.xy*pixelStep.xy+texOffset.xy);",
			"ptPos = texPosition.xy;",

			"texPosition *= vec4(viewSize, 1.0, 1.0);",

			"vec4 mvPosition = modelViewMatrix * texPosition;",

			"gl_PointSize = particleSize;",
			
			"gl_Position = projectionMatrix * mvPosition;",

		"}"

	].join("\n");



SHADER.FragmentMagneticFieldCompute = [
		
		"uniform vec4 magnets[MAX_MAGNETS];",
		"varying vec2 vUv;",


		"void main() {",

			"float u = 0.10;",
			"vec2 totalField = vec2(0.0,0.0);",

			"for(int i = 0; i < MAX_MAGNETS; ++i){",
				
				"if(magnets[i] != vec4(-1.0,-1.0,-1.0,-1.0)){",

				"vec2 dp = magnets[i].xy;",
				"dp *= 0.5;",
				"dp += 0.25;",
				"vec2 n = dp.xy - vUv;",
				"vec2 m = vUv - dp.xy;",
				"m *= magnets[i].z;",
				
				"float rT = pow(length(n), 3.0);",

				"n = normalize(n);",
				"float nDm = dot(n,m);",
				"n *= 3.0*nDm;",
				"n -= m;",
				"n /= rT;",
				"totalField += n;}",
			"}",
			
			"totalField *= u/(12.56636);", //4*PI = 12.56636
			"gl_FragColor = vec4( totalField ,0.0,1.0);",


		"}"

].join("\n");

SHADER.FragmentFilingsIntegration = [
		
		"uniform float speed;",
		"uniform float particleSize;",
		"uniform vec2 renderedFilingsSize;",
		"uniform sampler2D magneticField;",
		"uniform sampler2D fieldLines;",
		"uniform sampler2D computedOutput;",
		"uniform sampler2D renderedFilings;",
		"varying vec2 vUv;",

		"float rand(vec2 co){",
		    "return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);",
		"}",

		"void main() {",

			"vec2 pos = texture2D(computedOutput, vUv).xy;",
			"vec2 vel = texture2D(fieldLines, pos).xy;",
			"vec2 mag = texture2D(magneticField, pos*0.5+0.25).xy;",
			"vel += normalize(mag)*3.5;",


			"vec2 nPos = pos + vel*speed;",
			"nPos = clamp(nPos, 0.0, 1.0);",

			
			"vec2 testLength = vec2(particleSize+(0.7071067812*particleSize), particleSize+(0.7071067812*particleSize))/(renderedFilingsSize*1.5);",
			"vec2 testPos = pos + (normalize(vel)*testLength);",
			"vec4 atCol = texture2D(renderedFilings, testPos);",
			


			"gl_FragColor = vec4( rand(nPos) > 0.0001 && atCol.r > 0.925 ? nPos : pos,0.0,1.0);",

		"}"

].join("\n");
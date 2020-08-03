/**
* @author Lee Stemkoski   http://www.adelphi.edu/~stemkoski/
*/

///////////////////////////////////////////////////////////////////////////////

/////////////
// SHADERS //
/////////////

// attribute: data that may be different for each particle (such as size and color);
//      can only be used in vertex shader
// varying: used to communicate data from vertex shader to fragment shader
// uniform: data that is the same for each particle (such as texture)

const particleVertexShader =
[
"attribute vec3  customColor;",
"attribute float customOpacity;",
"attribute float customSize;",
"attribute float customAngle;",
"attribute float customVisible;",  // float used as boolean (0 = false, 1 = true)
"varying vec4  vColor;",
"varying float vAngle;",
"void main()",
"{",
	"if (customVisible > 0.5)", 				// true
		"vColor = vec4(customColor, customOpacity);", //     set color associated to vertex; use later in fragment shader.
	"else",							// false
		"vColor = vec4(0.0, 0.0, 0.0, 0.0);", 		//     make particle invisible.
		
	"vAngle = customAngle;",

	"vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",
	"gl_PointSize = customSize * ( 10.0 / length( mvPosition.xyz ) );",     // scale particles as objects in 3D space
	"gl_Position = projectionMatrix * mvPosition; // projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); // projectionMatrix * vec4( position, 1.0 ); //mvPosition;",
"}"
].join("\n");

const particleFragmentShader =
[
"uniform sampler2D texture1;",
"varying vec4 vColor;", 	
"varying float vAngle;",
"void main()", 
"{",
	"gl_FragColor = vColor;",
	
	"float c = cos(vAngle);",
	"float s = sin(vAngle);",
	"vec2 rotatedUV = vec2(c * (gl_PointCoord.x - 0.5) + s * (gl_PointCoord.y - 0.5) + 0.5,",
	                      "c * (gl_PointCoord.y - 0.5) - s * (gl_PointCoord.x - 0.5) + 0.5);",  // rotate UV coordinates to rotate texture
    	"vec4 rotatedTexture = texture2D( texture1,  rotatedUV );",

	"gl_FragColor = gl_FragColor * rotatedTexture; //texture2D(texture1,  vec2(0.5,0.5)); // gl_FragColor * rotatedTexture; //vec4(1.0,0.0,1.0,1.0); //gl_FragColor = gl_FragColor * rotatedTexture;",    // sets an otherwise white particle texture to desired color
"}"
].join("\n");

///////////////////////////////////////////////////////////////////////////////

/////////////////
// TWEEN CLASS //
/////////////////

export function Tween(timeArray, valueArray)
{
	this.times  = timeArray || [];
	this.values = valueArray || [];
}

Tween.prototype.lerp = function(t)
{
	var i = 0;
	var n = this.times.length;
	while (i < n && t > this.times[i])  
		i++;
	if (i == 0) return this.values[0];
	if (i == n)	return this.values[n-1];
	var p = (t - this.times[i-1]) / (this.times[i] - this.times[i-1]);
	if (this.values[0] instanceof THREE.Vector3)
		return this.values[i-1].clone().lerp( this.values[i], p );
	else // its a float
		return this.values[i-1] + p * (this.values[i] - this.values[i-1]);
}

///////////////////////////////////////////////////////////////////////////////

////////////////////
// PARTICLE CLASS //
////////////////////

function Particle()
{
	this.position     = new THREE.Vector3();
	this.velocity     = new THREE.Vector3(); // units per second
	this.acceleration = new THREE.Vector3();

	this.angle             = 0;
	this.angleVelocity     = 0; // degrees per second
	this.angleAcceleration = 0; // degrees per second, per second
	
	this.size = 16.0;

	this.color   = new THREE.Color();
	this.opacity = 1.0;
			
	this.age   = 0;
	this.alive = 0; // use float instead of boolean for shader purposes	
}

Particle.prototype.update = function(dt)
{
	this.position.add( this.velocity.clone().multiplyScalar(dt) );
	this.velocity.add( this.acceleration.clone().multiplyScalar(dt) );
	
	// convert from degrees to radians: 0.01745329251 = Math.PI/180
	this.angle         += this.angleVelocity     * 0.01745329251 * dt;
	this.angleVelocity += this.angleAcceleration * 0.01745329251 * dt;

	this.age += dt;
	
	// if the tween for a given attribute is nonempty,
	//  then use it to update the attribute's value

	if ( this.sizeTween.times.length > 0 )
		this.size = this.sizeTween.lerp( this.age );
				
	if ( this.colorTween.times.length > 0 )
	{
		var colorHSL = this.colorTween.lerp( this.age );
		this.color = new THREE.Color().setHSL( colorHSL.x, colorHSL.y, colorHSL.z );
	}
	
	if ( this.opacityTween.times.length > 0 )
		this.opacity = this.opacityTween.lerp( this.age );
}
	
///////////////////////////////////////////////////////////////////////////////

///////////////////////////
// PARTICLE ENGINE CLASS //
///////////////////////////

export var Type = Object.freeze({ "CUBE":1, "SPHERE":2 });

export function ParticleEngine()
{
	/////////////////////////
	// PARTICLE PROPERTIES //
	/////////////////////////
	
	this.positionStyle = Type.CUBE;		
	this.positionBase   = new THREE.Vector3();
	// cube shape data
	this.positionSpread = new THREE.Vector3();
	// sphere shape data
	this.positionRadius = 0; // distance from base at which particles start
	
	this.velocityStyle = Type.CUBE;	
	// cube movement data
	this.velocityBase       = new THREE.Vector3();
	this.velocitySpread     = new THREE.Vector3(); 
	// sphere movement data
	//   direction vector calculated using initial position
	this.speedBase   = 0;
	this.speedSpread = 0;
	
	this.accelerationBase   = new THREE.Vector3();
	this.accelerationSpread = new THREE.Vector3();	
	
	this.angleBase               = 0;
	this.angleSpread             = 0;
	this.angleVelocityBase       = 0;
	this.angleVelocitySpread     = 0;
	this.angleAccelerationBase   = 0;
	this.angleAccelerationSpread = 0;
	
	this.sizeBase   = 0.0;
	this.sizeSpread = 0.0;
	this.sizeTween  = new Tween();
			
	// store colors in HSL format in a THREE.Vector3 object
	// http://en.wikipedia.org/wiki/HSL_and_HSV
	this.colorBase   = new THREE.Vector3(0.0, 1.0, 0.5); 
	this.colorSpread = new THREE.Vector3(0.0, 0.0, 0.0);
	this.colorTween  = new Tween();
	
	this.opacityBase   = 1.0;
	this.opacitySpread = 0.0;
	this.opacityTween  = new Tween();

	this.blendStyle = THREE.NormalBlending; // false;

	this.particleArray = [];
	this.particlesPerSecond = 100;
	this.particleDeathAge = 1.0;
	
	////////////////////////
	// EMITTER PROPERTIES //
	////////////////////////
	
	this.emitterAge      = 0.0;
	this.emitterAlive    = true;
	this.emitterDeathAge = 60; // time (seconds) at which to stop creating particles.
	
	// How many particles could be active at any time?
	this.particleCount = this.particlesPerSecond * Math.min( this.particleDeathAge, this.emitterDeathAge );

	//////////////
	// THREE.JS //
	//////////////
	
	/*this.particleGeometry = new THREE.Geometry();
	this.particleTexture  = null;
	this.particleMaterial = new THREE.ShaderMaterial(
	{
		uniforms: 
		{
			texture:   { type: "t", value: this.particleTexture },
		},
		attributes:     
		{
			customVisible:	{ type: 'f',  value: [] },
			customAngle:	{ type: 'f',  value: [] },
			customSize:		{ type: 'f',  value: [] },
			customColor:	{ type: 'c',  value: [] },
			customOpacity:	{ type: 'f',  value: [] }
		},
		vertexShader:   particleVertexShader,
		fragmentShader: particleFragmentShader,
		transparent: true, // alphaTest: 0.5,  // if having transparency issues, try including: alphaTest: 0.5, 
		blending: THREE.NormalBlending, depthTest: true,
		
	});
	this.particleMesh = new THREE.Mesh();*/
}
	
ParticleEngine.prototype.setValues = function( parameters )
{
	if ( parameters === undefined ) return;
	
	// clear any previous tweens that might exist
	this.sizeTween    = new Tween();
	this.colorTween   = new Tween();
	this.opacityTween = new Tween();
	
	for ( var key in parameters ) 
		this[ key ] = parameters[ key ];
	
	// attach tweens to particles
	Particle.prototype.sizeTween    = this.sizeTween;
	Particle.prototype.colorTween   = this.colorTween;
	Particle.prototype.opacityTween = this.opacityTween;	
	
	// calculate/set derived particle engine values
	this.particleArray = [];
	this.emitterAge      = 0.0;
	this.emitterAlive    = true;
	this.particleCount = this.particlesPerSecond * Math.min( this.particleDeathAge, this.emitterDeathAge );
	
	this.particleGeometry = new THREE.BufferGeometry();
	//  type: "t",
	//debugger;
	this.particleMaterial = new THREE.ShaderMaterial( 
	{
		uniforms: 
		{
			texture1:   {value: this.particleTexture },
		},
		vertexShader:   particleVertexShader,
		fragmentShader: particleFragmentShader,
		transparent: true,  alphaTest: 0.5, // if having transparency issues, try including: alphaTest: 0.5, 
		blending: THREE.NormalBlending, depthTest: true
	});

	const positions = new Array(this.particleCount * 3).fill(0);
	this.particleGeometry.setAttribute( 'position', new THREE.BufferAttribute(new Float32Array(positions), 3));
	this.particleGeometry.setAttribute('customVisible', new THREE.BufferAttribute(new Float32Array(new Array(this.particleCount).fill(1)), 1));
	this.particleGeometry.setAttribute('customAngle', new THREE.BufferAttribute(new Float32Array(new Array(this.particleCount).fill(0)), 1));
	this.particleGeometry.setAttribute('customSize', new THREE.BufferAttribute(new Float32Array(new Array(this.particleCount).fill(0)), 1));
	this.particleGeometry.setAttribute('customColor', new THREE.BufferAttribute(new Float32Array(new Array(this.particleCount * 3).fill(0)), 3));
	this.particleGeometry.setAttribute('customOpacity', new THREE.BufferAttribute(new Float32Array(new Array(this.particleCount).fill(1)), 1));

	//this.particleMesh = new THREE.ParticleSystem();
}
	
// helper functions for randomization
ParticleEngine.prototype.randomValue = function(base, spread)
{
	return base + spread * (Math.random() - 0.5);
}
ParticleEngine.prototype.randomVector3 = function(base, spread)
{
	var rand3 = new THREE.Vector3( Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5 );
	return new THREE.Vector3().addVectors( base, new THREE.Vector3().multiplyVectors( spread, rand3 ) );
}


ParticleEngine.prototype.createParticle = function()
{
	var particle = new Particle();

	if (this.positionStyle == Type.CUBE)
		particle.position = this.randomVector3( this.positionBase, this.positionSpread ); 
	if (this.positionStyle == Type.SPHERE)
	{
		var z = 2 * Math.random() - 1;
		var t = 6.2832 * Math.random();
		var r = Math.sqrt( 1 - z*z );
		var vec3 = new THREE.Vector3( r * Math.cos(t), r * Math.sin(t), z );
		particle.position = new THREE.Vector3().addVectors( this.positionBase, vec3.multiplyScalar( this.positionRadius ) );
	}
		
	if ( this.velocityStyle == Type.CUBE )
	{
		particle.velocity     = this.randomVector3( this.velocityBase,     this.velocitySpread ); 
	}
	if ( this.velocityStyle == Type.SPHERE )
	{
		var direction = new THREE.Vector3().subVectors( particle.position, this.positionBase );
		var speed     = this.randomValue( this.speedBase, this.speedSpread );
		particle.velocity  = direction.normalize().multiplyScalar( speed );
	}
	
	particle.acceleration = this.randomVector3( this.accelerationBase, this.accelerationSpread );

	particle.angle             = this.randomValue( this.angleBase,             this.angleSpread );
	particle.angleVelocity     = this.randomValue( this.angleVelocityBase,     this.angleVelocitySpread );
	particle.angleAcceleration = this.randomValue( this.angleAccelerationBase, this.angleAccelerationSpread );

	particle.size = this.randomValue( this.sizeBase, this.sizeSpread );

	var color = this.randomVector3( this.colorBase, this.colorSpread );
	particle.color = new THREE.Color().setHSL( color.x, color.y, color.z );
	
	particle.opacity = this.randomValue( this.opacityBase, this.opacitySpread );

	particle.age   = 0;
	particle.alive = 0; // particles initialize as inactive
	
	return particle;
}

ParticleEngine.prototype.initialize = function(scene)
{
	// link particle data with geometry/material data
	for (var i = 0, j = 0; j < this.particleCount;  i = i + 3, j++)
	{
		// remove duplicate code somehow, here and in update function below.
		this.particleArray[j] = this.createParticle();
		//debugger;

		const positions = this.particleGeometry.attributes.position.array;
		positions[i] = this.particleArray[j].position.x;
		positions[i + 1] = this.particleArray[j].position.y;
		positions[i + 2] = this.particleArray[j].position.z;
		this.particleGeometry.attributes.position.needsUpdate = true;
		//this.particleGeometry.vertices[i] = this.particleArray[i].position;

		//debugger;
		this.particleGeometry.attributes.customVisible.array[j] = this.particleArray[j].alive;
		this.particleGeometry.attributes.customVisible.needsUpdate = true;
		this.particleGeometry.attributes.customColor.array[i] = this.particleArray[j].color.r;
		this.particleGeometry.attributes.customColor.array[i + 1] = this.particleArray[j].color.g;
		this.particleGeometry.attributes.customColor.array[i + 2] = this.particleArray[j].color.b;
		this.particleGeometry.attributes.customColor.needsUpdate = true;
		this.particleGeometry.attributes.customOpacity.array[j] = this.particleArray[j].opacity;
		this.particleGeometry.attributes.customOpacity.needsUpdate = true;
		this.particleGeometry.attributes.customSize.array[j] = this.particleArray[j].size;
		this.particleGeometry.attributes.customSize.needsUpdate = true;
		this.particleGeometry.attributes.customAngle.array[j] = this.particleArray[j].angle;
		this.particleGeometry.attributes.customAngle.needsUpdate = true;
	}
	
	this.particleMaterial.blending = this.blendStyle;
	if ( this.blendStyle != THREE.NormalBlending) 
		this.particleMaterial.depthTest = false;

	const material = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
	const material2 = new THREE.PointsMaterial( { color: 0x888888 } );
	this.particleMesh = new THREE.Points( this.particleGeometry, this.particleMaterial); //this.particleMaterial );
	this.particleMesh.dynamic = true;
	this.particleMesh.sortParticles = true;


	///////////////
	/*var vertices = [];
	for (var i = 0; i < 10000; i++) {
		var x = THREE.MathUtils.randFloatSpread( 2000 );
		var y = THREE.MathUtils.randFloatSpread( 2000 );
		var z = THREE.MathUtils.randFloatSpread( 2000 );
		vertices.push( x, y, z );
	}*/
	const geometry = new THREE.BufferGeometry();
	//geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
	const positions = new Array(this.particleCount * 3).fill(0);
	geometry.setAttribute( 'position', new THREE.BufferAttribute(new Float32Array(positions), 3));
	//const material2 = new THREE.PointsMaterial( { color: 0x888888 } );
	//const points = new THREE.Points(this.particleGeometry, material2); // material2
	//scene.add( points );

	//////////////


	scene.add( this.particleMesh );
}

ParticleEngine.prototype.update = function(dt)
{
	dt = dt / 1000;
	//return
	var recycleIndices = [];
	
	// update particle data
	for (var i = 0; i < this.particleCount; i++)
	{
		if ( this.particleArray[i].alive )
		{
			this.particleArray[i].update(dt);

			// check if particle should expire
			// could also use: death by size<0 or alpha<0.
			if (this.particleArray[i].age > this.particleDeathAge )
			{
				this.particleArray[i].alive = 0.0;
				recycleIndices.push(i);
			}
			//console.log('Alive: ' + this.particleArray[i].alive);
			// update particle properties in shader
			this.particleGeometry.attributes.customVisible.array[i] = this.particleArray[i].alive;
			this.particleGeometry.attributes.customVisible.needsUpdate = true;
			this.particleGeometry.attributes.customColor.array[i * 3] = this.particleArray[i].color.r;
			this.particleGeometry.attributes.customColor.array[i * 3 + 1] = this.particleArray[i].color.g;
			this.particleGeometry.attributes.customColor.array[i * 3 + 2] = this.particleArray[i].color.b;
			this.particleGeometry.attributes.customColor.needsUpdate = true;
			this.particleGeometry.attributes.customOpacity.array[i] = this.particleArray[i].opacity;
			this.particleGeometry.attributes.customOpacity.needsUpdate = true;
			this.particleGeometry.attributes.customSize.array[i] = this.particleArray[i].size;
			this.particleGeometry.attributes.customSize.needsUpdate = true;
			this.particleGeometry.attributes.customAngle.array[i] = this.particleArray[i].angle;
			this.particleGeometry.attributes.customAngle.needsUpdate = true;

			/*this.particleMaterial.attributes.customVisible.value[i] = this.particleArray[i].alive;
			this.particleMaterial.attributes.customColor.value[i]   = this.particleArray[i].color;
			this.particleMaterial.attributes.customOpacity.value[i] = this.particleArray[i].opacity;
			this.particleMaterial.attributes.customSize.value[i]    = this.particleArray[i].size;
			this.particleMaterial.attributes.customAngle.value[i]   = this.particleArray[i].angle;*/
		}		
	}

	// check if particle emitter is still running
	if ( !this.emitterAlive ) return;

	// if no particles have died yet, then there are still particles to activate
	if ( this.emitterAge < this.particleDeathAge )
	{
		// determine indices of particles to activate
		var startIndex = Math.round( this.particlesPerSecond * (this.emitterAge +  0) );
		var   endIndex = Math.round( this.particlesPerSecond * (this.emitterAge + dt) );
		if  ( endIndex > this.particleCount ) 
			  endIndex = this.particleCount; 
			  
		for (var i = startIndex; i < endIndex; i++)
			this.particleArray[i].alive = 1.0;		
	}

	// if any particles have died while the emitter is still running, we imediately recycle them
	for (var j = 0; j < recycleIndices.length; j++)
	{
		var i = recycleIndices[j];
		this.particleArray[i] = this.createParticle();
		this.particleArray[i].alive = 1.0; // activate right away
		//console.log(1);

		//this.particleGeometry.vertices[i] = this.particleArray[i].position;
		const positions = this.particleGeometry.attributes.position.array;
		positions[i * 3] = this.particleArray[i].position.x;
		positions[i * 3 + 1] = this.particleArray[i].position.y;
		positions[i * 3 + 2] = this.particleArray[i].position.z;
		this.particleGeometry.attributes.position.needsUpdate = true;
	}

	// stop emitter?
	this.emitterAge += dt;
	if ( this.emitterAge > this.emitterDeathAge )  this.emitterAlive = false;
}

ParticleEngine.prototype.destroy = function()
{
    scene.remove( this.particleMesh );
}
///////////////////////////////////////////////////////////////////////////////
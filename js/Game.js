define("Game",["Ship","GameUtil"],function(Ship,GameUtil) {
	function Game(renderer,hud,console,audio) {
		this.victory = false;
		this.frameNumber = 0;
		this.lastFrame = Date.now();
		this.timeDelta = 0;
		this.ship = new Ship();
		this.renderer = renderer;
		this.hud = hud;
		this.console = console;
		this.audio = audio;
		this.functions = [];
		this.version = "0.2.2";
		this.helpText = [];
		this.alert = "none";
		this.debug = false;
		var self = this;
		$("#guide ul").each(function() {
			$(this).children().each(function() {
				self.helpText[$(this).find(".command").text().replace(/\s/g,'')] = 
				[$(this).find(".arguments").html(),
				$(this).find(".description").html()];
			});
		});
	}
	Game.prototype = {
		run: function() {
			this.tick();
			this.console.repl();
		},
		tick: function() {
			// sanity checks
			if(!this.ship) {
				throw new Error("No ship object to work with!");
			}
			// game over checks
			if(GameUtil.endGameConditionCheck(this.ship)) {
				if(!this.victory)
					$("#gameover").show();
				return; // game over
			} else {
				requestAnimationFrame(this.tick.bind(this));
			}

			GameUtil.updateBoosters(this.ship);
			GameUtil.updateStructuralIntegrityFields(this.ship);
			GameUtil.updateRotation(this.ship);
			GameUtil.updateVelocities(this.ship);
			this.updateCannons();

			this.runCustomFunctions();
			this.updateVariables();
			// do animation updates after logic updates
			this.renderer.render(this.frameNumber,this.timeDelta,this.ship);
			this.hud.render(this.frameNumber,this.timeDelta,this.ship,this.alert);
			// finally do audio updates last of all, because sound travels slower than light ;)
			this.audio.update(this.frameNumber,this.timeDelta,this.ship);
		},
		addFunction: function(f) {
			this.functions.push(f);
		},
		runCustomFunctions: function() {
			var self = this;
			this.functions.forEach(function(f) {
				if(f.apply(self)) {
					self.functions.splice(f,1);
				}
			});
		},
		updateVariables: function() {
			this.frameNumber++;
			this.timeDelta = Date.now() - this.lastFrame;
			this.lastFrame = Date.now();
			this.stardate = (new Date().getTime()) / 1000;
		},
		updateCannons: function() {
			var self = this;
			function updateCannon(cannon) {
				if(Math.abs(cannon.rotationDelta.y) > Math.PI / 64) {
					cannon.rotation.y += (cannon.rotationDelta.y / Math.abs(cannon.rotationDelta.y)) * (Math.PI / 64);
					cannon.rotationDelta.y -= (cannon.rotationDelta.y / Math.abs(cannon.rotationDelta.y)) * (Math.PI / 64);
				} else {
					cannon.rotation.y += cannon.rotationDelta.y;
					cannon.rotationDelta.y = 0;
				}
				if(Math.abs(cannon.rotationDelta.x) > Math.PI / 64) {
					cannon.rotation.x += (cannon.rotationDelta.x / Math.abs(cannon.rotationDelta.x)) * (Math.PI / 64);
					cannon.rotationDelta.x -= (cannon.rotationDelta.x / Math.abs(cannon.rotationDelta.x)) * (Math.PI / 64);
				} else {
					cannon.rotation.x += cannon.rotationDelta.x;
					cannon.rotationDelta.x = 0;
				}
				if(cannon.power > 0) {
					self.renderer.fireBullet(cannon);
					self.audio.playSound('bullet');
					cannon.power = 0;
				}
			}
			updateCannon(this.ship.cannons.fore);
			updateCannon(this.ship.cannons.aft);
		},
		spawnTargetDrone: function() {
		    // add a target drone
		    var DRONE_SIZE = 50;
		    var droneGeom = new THREE.SphereGeometry(DRONE_SIZE,32,32);
		    var droneMat = new THREE.MeshBasicMaterial({
		            color:0xFF0000
		    });
		    var camera = this.renderer.camera;
		    drone = new THREE.Mesh(droneGeom,droneMat);
		    drone.position.getPositionFromMatrix(camera.matrix);
		    drone.rotation.setFromRotationMatrix(camera.matrix);
		    drone.translateZ(-50);
		    drone.isDrone = true; // I know it looks weird, but this is a quick way to differentiate between drones and bullets in the OctTree
		    drone.isAlive = true;
		    drone.xDir = 1;
		    this.renderer.scene.add(drone);
		    this.renderer.drones.push(drone);
		    this.renderer.tree.insert(drone);
		    this.functions.push((function(d) {
		    	return function() {
		            if(camera.position.distanceTo(d.position) < 500) {
		                    d.translateZ(-5);
		            } else {
		                    d.yTranslate = Math.sin(this.frameNumber/20) * this.timeDelta * 0.1;
		                    d.xTranslate = Math.cos(d.yTranslate) * d.xDir * 3;
		                    if(Math.random() < 0.1) {
		                            d.xDir = -d.xDir;
		                    }
		                    d.translateY(d.yTranslate);
		                    d.translateX(d.xTranslate);
		            }
		            return !d.isAlive;
		        }
		    })(drone));
		},
		guide: function(target) {
			switch(target) {
				case 'console':
					for(command in this.helpText) {
						if(this.helpText.hasOwnProperty(command)) {
							this.console.showHelp(command,this.helpText[command][0],this.helpText[command][1]);
						}
					}
				break;
				case 'modal':
					$("#guide").dialog({
						width: "70vw"
					});
				break;
			}
		},
		setAlert: function(to) {
			this.alert = to;
			switch(to) {
				case "none":
					$("#viewscreen").css({
						"border":"solid 3px #999"
					});
					break;
				case "yellow":
					this.addFunction(function() {
						if(this.frameNumber % 30 == 0) {
							$("#viewscreen").animate({
								borderColor: "#990"
							},'fast').animate({
								borderColor: "#999"
							},'fast');
							this.audio.playSound('yellow-alert');
						}
						return (this.alert != "yellow");
					});
					break;
				case "red":
					this.addFunction(function() {
						if(this.frameNumber % 30 == 0) {
							$("#viewscreen").animate({
								borderColor: "#900"
							},'fast').animate({
								borderColor: "#999"
							},'fast');
						}
						if(this.frameNumber % 15 == 0) {
							this.audio.playSound('red-alert');
						}
						return (this.alert != "red");
					});
					break;
			}
		}
	}
	return Game;
});
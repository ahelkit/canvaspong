Controllers = new Meteor.Collection('controllers');

if (Meteor.isClient) {
  Meteor.subscribe('controllers');

  var W = window.innerWidth,
      H = window.innerHeight,
      paddleLeft = new Paddle('left'),
      paddleRight = new Paddle('right'),
      paddles = [paddleLeft, paddleRight],
      particlesCount = 30,
      particlePos = {},
      particles = [],
      controllerUpdateCount = 0,
      startGame = true;

  Template.hidden.controllers = function () {
    Session.set('shouldStartGame', true);
    Session.set('shouldMoveController', true);
    return Controllers.find({});
  };

  Deps.autorun(function () {
    controllerUpdateCount++;
    if (Session.equals("shouldMoveController", true)) {
      setPaddleRoll('1');
      setPaddleRoll('2');
    }
  });

  var setPaddleRoll = function(index) {
    var controller = Controllers.findOne({name: 'controller' + index});
    if (!controller) { return; }
    if (controller.roll < 0.0) { return; }
    paddles[index-1].normalizedRoll = controller.roll / Math.PI;
  }

  function Paddle(pos) {
    this.h = 150;
    this.w = 5;
    this.y = H/2 - this.h/2;
    this.x = (pos == "left") ? 0 : W - this.w;
    this.score = 0;
  }

  Template.hello.rendered = function() {
    window.requestAnimFrame = (function(){
      return  window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame    ||
        window.oRequestAnimationFrame      ||
        window.msRequestAnimationFrame     ||
        function( callback ){
          return window.setTimeout(callback, 1000 / 60);
        };
    })();
    window.cancelRequestAnimFrame = ( function() {
      return window.cancelAnimationFrame          ||
        window.webkitCancelRequestAnimationFrame  ||
        window.mozCancelRequestAnimationFrame     ||
        window.oCancelRequestAnimationFrame       ||
        window.msCancelRequestAnimationFrame      ||
        clearTimeout
    })();

    var canvas = document.getElementById("canvas"),
        ctx = canvas.getContext("2d"),
        ball = {},
        mouse = {},
        init; // to init animation
        img = document.getElementById("logo");

    canvas.addEventListener("mousemove", trackPosition, true);
    canvas.width = W;
    canvas.height = H;

    function trackPosition(e) {
      mouse.x = e.pageX;
      mouse.y = e.pageY;
    }

    ball = {
      x: canvas.width / 2,
      y: canvas.height / 2,
      r: 5,
      c: "#efebd1",
      vx: 8,
      vy: 4,
      // Function for drawing ball on canvas
      draw: function() {
        ctx.beginPath();
        ctx.fillStyle = this.c;
        ctx.arc(this.x, this.y, this.r, 0, Math.PI*2, false);
        ctx.fill();
      },
      reset: function() {
        this.x = canvas.width / 2,
        this.y = canvas.height / 2
      }
    };

    // game loop
    function update() {
      if (mouse.x && mouse.y) {
        paddleLeft.y = mouse.y - paddleLeft.w / 2;
        paddleRight.y = mouse.y - paddleRight.w / 2;
      }

      particlePos.x = ball.x ;
      particlePos.y = ball.y;

      ball.x += ball.vx;
      ball.y += ball.vy;

      var multiplier = 1;
      for(var k = 0; k < particlesCount; k++) {
        particles.push(new createParticles(particlePos.x, particlePos.y, multiplier));
      }
      emitParticles();

      detectCollision();
      updateScore();
    }

    function createParticles(x, y, m) {
      this.x = x || 0;
      this.y = y || 0;
      this.radius = 2.2;
      this.vx = -1.5 + Math.random()*3;
      this.vy = m * Math.random()*1.5;
    }

    function emitParticles() {
      var particleColors = ['#F7AA4E', '#F7941C'];

      for(var j = 0; j < particles.length; j++) {
        par = particles[j];
        ctx.beginPath();
        var color = particleColors[Math.round(Math.random()*2)];
        ctx.fillStyle = color;
        if (par.radius > 0) {
          ctx.arc(par.x, par.y, par.radius, 0, Math.PI*2, false);
        }
        ctx.fill();
        ctx.fillStyle = "#efebd1";
        par.x += par.vx;
        par.y += par.vy;
        // Reduce radius so that the particles die after a few seconds
        par.radius = Math.max(par.radius - 0.05, 0.0);
      }
    }

    function restartGame() {
      ball.y = -1000;
      particles.length = 0;
      draw();
      cancelRequestAnimFrame(init);
      if (_.max(_.pluck(paddles, 'score')) < 11) {
        ball.reset();
        Meteor.setTimeout(animloop, 3000);
        countDown(3);
        Meteor.setTimeout(function() {
          countDown(2);
        }, 1000);
        Meteor.setTimeout(function() {
          countDown(1);
        }, 2000);
      }
    }

    function countDown(number) {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStlye = "#efebd1";
      ctx.font = "124px 'outageregular', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(number, canvas.width/2, canvas.height/2 );
    }

    function updateScore() {
      ctx.fillStlye = "#efebd1";
      ctx.font = "48px 'outageregular', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(paddleLeft.score + " - " + paddleRight.score, canvas.width/2, 100);
    }

    function updateReadyState(controller, side) {
      if (!controller.start) { return; }
      ctx.fillStlye = "#efebd1";
      ctx.font = "32px 'outageregular', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      var locX = side === "left" ? 150 : 1350;
      ctx.fillText("READY!", locX, 100 );
    }

    function detectCollision() {
      // left wall
      if (ball.y <= 0) {
        ball.vy *= -1;
      }

      // right wall
      if (ball.y >= canvas.height) {
        ball.vy *= -1;
      }

      // paddles
      detectPaddleCollision(ball, ball.x >= canvas.width, paddleRight, paddleLeft);
      detectPaddleCollision(ball, ball.x < 0, paddleLeft, paddleRight);
    }

    function detectPaddleCollision(ball, atWall, paddle, scorePaddle) {
      if (atWall) {
        if (ball.y >= paddle.y && ball.y <= paddle.y + paddle.h) {
          ball.vx *= -1;
        } else {
          // no collision, score!
          scorePaddle.score += 1;
          ball.vx *= -1;
          restartGame();
        }
        particles.length = 0;
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      for(var i = 0; i < paddles.length; i++) {
        p = paddles[i];
        ctx.fillStyle = "#efebd1";
        ctx.fillRect(p.x, p.y, p.w, p.h);
      }
      ball.draw();
      update();
    }

    function animloop() {
      init = requestAnimFrame(animloop);
      draw();
    }

    draw();

    Meteor.setInterval(function() {
      var controller1 = Controllers.findOne({name: 'controller1'});
      var controller2 = Controllers.findOne({name: 'controller2'});
      updateReadyState(controller1, 'left');
      updateReadyState(controller2, 'right');
      if (startGame) {
        restartGame();
        startGame = false;
        Controllers.update({_id: 'controller1'}, {$set: {start: false}});
        Controllers.update({_id: 'controller2'}, {$set: {start: false}});
      }
    }, 500);
  }
}

if (Meteor.isServer) {
  var upsertController = function(name) {
    var controller = Controllers.findOne({_id: name});
    if (!controller) {
        Controllers.insert({_id: name, name: name, accelX: 0.0, accelY: 0.0, accelZ: 0.0});
    }
  }

  Meteor.startup(function () {
    upsertController('controller1');
    upsertController('controller2');
    Meteor.publish('controllers', function() {
      return Controllers.find({});
    });
  });
}

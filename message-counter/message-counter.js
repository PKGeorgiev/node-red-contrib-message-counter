module.exports = function (RED) {
    function MessageCounterNode(config) {
        console.log('CTOR: MessageCounterNode');
        RED.nodes.createNode(this, config);

        var node = this;
        var ctr = {};
        var ctrTotal = {};
        var allctr = 0;


        node.status({});
        node.units = config.units;
        node.interval = config.interval;
        node.alignToClock = config.alignToClock;
        node.generator = config.generator;
        node.debugMode = config.debugMode;

        if (node.debugMode)
            console.log("INFO! " + node.interval + " | " + node.units + " | " + node.alignToClock);

        function measure(isReset) {
            if (node.debugMode) {
                console.log(new Date());
                console.log("INFO: " + node.interval + " | " + node.units + " | " + node.alignToClock);
            }

            for (var index in ctr) {
                msg = {};
                msg.topic = index
                msg.payload = ctr[index];
                msg.interval = parseInt(node.interval);
                msg.units = node.units;
                msg.generator = node.generator;
                msg.alignToClock = node.alignToClock;
                msg.totalMessageCount = ctrTotal[index];
                msg.isReset = isReset;
                if (isReset) {
                    //delete ctr[index];
                    ctr[index] = 0;
                    allctr = 0;
                };
                node.send([msg, null]);
            }
            showCount();
        }

        function getRemainingMs(units, interval) {
            var now = new Date();

            switch (units) {
                case "seconds": {
                    return interval * 1000 - now.getMilliseconds();
                }; break;

                case "minutes": {
                    return (interval * 60 - now.getSeconds()) * 1000 - now.getMilliseconds();
                }; break;

                case "hours": {
                    return (interval * 3600 - now.getSeconds()) * 1000 - now.getMilliseconds();
                }; break;
            };

        }

        function intervalToMs(units, interval) {
            switch (units) {
                case "seconds": {
                    return interval * 1000;
                }; break;

                case "minutes": {
                    return interval * 60 * 1000;
                }; break;

                case "hours": {
                    return interval * 3600 * 1000;
                }; break;
            };

        }

        function runClock() {
            var timeToNextTick = getRemainingMs(node.units, node.interval);
            if (node.debugMode)
                console.log("timeToNextTick: " + timeToNextTick);

            return setTimeout(function () {
                measure(true);
                node.internalTimer = runClock();
            }, timeToNextTick);
        }

        function startGenerator() {
            if (node.generator != "internal")
                return;

            if (node.alignToClock) {
                node.internalTimer = runClock();
            } else {
                var interval = intervalToMs(node.units, node.interval);
                if (node.debugMode)
                    console.log("Interval: " + interval);
                node.internalTimer = setInterval(measure, interval);
            };

        }

        function stopGenerator() {
            if (node.generator != "internal")
                return;

            if (node.alignToClock) {
                clearTimeout(node.internalTimer);
            } else {
                clearInterval(node.internalTimer);
            };

        }

        function showCount() {
            node.status({ fill: "green", shape: "dot", text: allctr });
        };

        showCount();
        startGenerator();

        this.on('input', function (msg) {
            if (msg.topic == "mc-control") {
                // This is a control message
                switch (msg.payload) {
                    case "measure": {
                        measure(true);

                    }; break;

                    case "report": {
                        measure(false);

                    }; break;

                    default: {
                        node.status({ fill: "red", shape: "dot", text: "Invalid control command: " + msg.payload });
                    }
                }
            } else {
                // Count messages
                if (typeof ctr[msg.topic] == 'undefined') {
                    ctr[msg.topic] = 1;
                } else {
                    ctr[msg.topic]++;
                }

                if (typeof ctrTotal[msg.topic] == 'undefined') {
                    ctrTotal[msg.topic] = 1;
                } else {
                    ctrTotal[msg.topic]++;
                }
                allctr++;
                showCount();
                node.send([null, msg]);
            }


        });

        this.on('close', function () {
            // tidy up any state
            if (node.debugMode)
                console.log("CLEANUP");
            stopGenerator();
        });
    }
    RED.nodes.registerType("Message Counter", MessageCounterNode);
}
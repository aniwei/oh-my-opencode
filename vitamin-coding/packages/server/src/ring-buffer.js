"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RingBuffer = void 0;
var RingBuffer = /** @class */ (function () {
    function RingBuffer(capacity) {
        this.capacity = capacity;
        this.head = 0;
        this.tail = 0;
        this.count = 0;
        this.buffer = new Array(capacity);
    }
    RingBuffer.prototype.push = function (item) {
        this.buffer[this.tail] = item;
        this.tail = (this.tail + 1) % this.capacity;
        if (this.count < this.capacity) {
            this.count++;
        }
        else {
            this.head = (this.head + 1) % this.capacity;
        }
    };
    RingBuffer.prototype.toArray = function () {
        var result = new Array(this.count);
        for (var i = 0; i < this.count; i++) {
            var item = this.buffer[(this.head + i) % this.capacity];
            if (item !== undefined) {
                result[i] = item;
            }
        }
        return result;
    };
    return RingBuffer;
}());
exports.RingBuffer = RingBuffer;

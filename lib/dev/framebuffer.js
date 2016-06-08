// -------------------------------------------------
// ---------------- Framebuffer --------------------
// -------------------------------------------------
// Framebuffer not presently implemented, a dummy is provided
// TODO: use node-canvas

function ConsoleFramebuffer() { }
ConsoleFramebuffer.prototype.SetAddr = function(addr) { };
ConsoleFramebuffer.prototype.Update = function() { };

module.exports = ConsoleFramebuffer;

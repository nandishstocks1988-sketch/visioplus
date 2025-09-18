/**
 * throttle & debounce utilities
 */

export function throttle(fn, wait) {
    let last = 0;
    let timer = null;
    let ctx, args;

    function run() {
        last = Date.now();
        timer = null;
        fn.apply(ctx, args);
    }

    return function (...a) {
        const now = Date.now();
        const remaining = wait - (now - last);
        ctx = this;
        args = a;
        if (remaining <= 0) {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            run();
        } else if (!timer) {
            timer = setTimeout(run, remaining);
        }
    };
}

export function debounce(fn, wait) {
    let timer = null;
    return function (...a) {
        clearTimeout(timer);
        const ctx = this;
        timer = setTimeout(() => fn.apply(ctx, a), wait);
    };
}

console.log('throttle.js loaded');
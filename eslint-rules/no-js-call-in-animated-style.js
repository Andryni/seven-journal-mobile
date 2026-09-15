/* eslint-disable */
/**
 * Flags a locally-defined JS function called from inside a Reanimated worklet
 * hook (useAnimatedStyle / useAnimatedProps / useDerivedValue / ...).
 *
 * Written after a real crash: a `pct()` helper defined in the component body
 * was called from useAnimatedStyle, which runs on the UI runtime. Reanimated
 * threw "[Worklets] Tried to synchronously call a Remote Function" on the
 * first animation frame and took the screen down.
 *
 * Neither tsc, the unit tests, a successful Metro bundle nor a Jest render
 * test can see this: mocks execute worklets on the JS thread, where the call
 * is perfectly legal. It is only detectable statically, hence this rule.
 *
 * Reports a call only when the callee is a function declared in an enclosing
 * scope *inside the file*. Imported helpers, globals (Math, Number) and
 * Reanimated's own API are left alone, so the rule does not fire on the
 * legitimate patterns already in the codebase.
 */

const WORKLET_HOOKS = new Set([
  'useAnimatedStyle',
  'useAnimatedProps',
  'useDerivedValue',
  'useAnimatedScrollHandler',
  'useAnimatedReaction',
  'useFrameCallback',
]);

const ALLOWED = new Set([
  'withTiming', 'withSpring', 'withDecay', 'withDelay', 'withRepeat',
  'withSequence', 'interpolate', 'interpolateColor', 'clamp', 'runOnJS',
  'measure', 'scrollTo', 'cancelAnimation', 'Number', 'String', 'Boolean',
]);

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'disallow calling a locally-defined JS function from inside a Reanimated worklet',
    },
    schema: [],
    messages: {
      jsCallInWorklet:
        "'{{name}}' is a JS function defined in this file and cannot be called from " +
        "inside {{hook}}, which runs on the UI runtime. Compute the value on the JS " +
        'thread and capture it as a plain value, or mark the helper with the ' +
        "'worklet' directive.",
    },
  },

  create(context) {
    // Stack of worklet hooks we are currently inside.
    const workletStack = [];

    function isWorkletHookCall(node) {
      return (
        node.type === 'CallExpression' &&
        node.callee.type === 'Identifier' &&
        WORKLET_HOOKS.has(node.callee.name)
      );
    }

    function functionBodyHasWorkletDirective(fnNode) {
      const body = fnNode && fnNode.body;
      if (!body || body.type !== 'BlockStatement') return false;
      return body.body.some(
        st =>
          st.type === 'ExpressionStatement' &&
          st.expression.type === 'Literal' &&
          st.expression.value === 'worklet'
      );
    }

    function resolveLocalFunction(name, scope) {
      let s = scope;
      while (s) {
        const variable = s.variables.find(v => v.name === name);
        if (variable) {
          // Imported bindings are not local definitions.
          const defs = variable.defs || [];
          if (defs.length === 0) return null;
          const def = defs[0];
          if (def.type === 'ImportBinding') return null;
          if (def.type === 'FunctionName') return def.node;
          if (
            def.type === 'Variable' &&
            def.node.init &&
            (def.node.init.type === 'ArrowFunctionExpression' ||
              def.node.init.type === 'FunctionExpression')
          ) {
            return def.node.init;
          }
          return null;
        }
        s = s.upper;
      }
      return null;
    }

    return {
      CallExpression(node) {
        if (isWorkletHookCall(node)) {
          workletStack.push(node.callee.name);
          return;
        }
        if (workletStack.length === 0) return;

        // Only bare identifier calls; `obj.method()` is out of scope.
        if (node.callee.type !== 'Identifier') return;
        const name = node.callee.name;
        if (ALLOWED.has(name)) return;

        const scope = context.getScope();
        const fnNode = resolveLocalFunction(name, scope);
        if (!fnNode) return;
        if (functionBodyHasWorkletDirective(fnNode)) return;

        context.report({
          node,
          messageId: 'jsCallInWorklet',
          data: { name, hook: workletStack[workletStack.length - 1] },
        });
      },

      'CallExpression:exit'(node) {
        if (isWorkletHookCall(node)) workletStack.pop();
      },
    };
  },
};

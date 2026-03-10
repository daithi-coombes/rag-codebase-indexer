package fixture

import (
	"fmt"
	"math"
	"sync"
)

// --- Top-level variable (var_declaration) ---

var FooBar = "bizBaz"

// --- Top-level constant (const_declaration) ---

const MaxRetries = 3

// --- Const block / iota (const_declaration) ---

const (
	StatusPending  = iota
	StatusActive
	StatusInactive
)

// --- Struct type (type_declaration → struct_type) ---

type FixtureStruct struct {
	Property1 string
	Property2 string
	mu        sync.Mutex
}

// --- Interface type (type_declaration → interface_type) ---

type FixtureInterface interface {
	Method1(param1, param2 int) int
	Method2(param1, param2 int) (int, error)
}

// --- Type alias (type_declaration) ---

type Distance float64

// --- Method with value receiver (method_declaration) ---

func (f FixtureStruct) Method1(param1, param2 int) int {
	return param1 - param2
}

// --- Method with pointer receiver (method_declaration) ---

func (f *FixtureStruct) Method2(param1, param2 int) (int, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return param1 + param2, nil
}

// --- Standalone function (function_declaration) ---

func fixtureFunction(param1 string, param2 map[string]interface{}) map[string]interface{} {
	param2["res"] = param1
	return param2
}

// --- Exported function (function_declaration) ---

func FixtureExportedFunction(x, y float64) float64 {
	return math.Sqrt(x*x + y*y)
}

// --- Variadic function (function_declaration) ---

func fixtureVariadic(prefix string, values ...int) string {
	sum := 0
	for _, v := range values {
		sum += v
	}
	return fmt.Sprintf("%s: %d", prefix, sum)
}

// --- Multiple return values (function_declaration) ---

func fixtureTuple() (string, error) {
	return "hello", nil
}

// --- Function using func literal / closure (func_literal via short_var_declaration) ---

func fixtureWithClosure() {
	handler := func(msg string) string {
		return fmt.Sprintf("handled: %s", msg)
	}

	_ = handler("test")
}

// --- Top-level short var is not valid Go, so we use var for the func literal case ---

var fixtureArrow = func(param1 string) string {
	return param1 + " addition string stuff"
}

// --- Goroutine + channel usage inside a function ---

func fixtureGoroutine(input string) <-chan string {
	ch := make(chan string, 1)
	go func() {
		ch <- fmt.Sprintf("processed: %s", input)
	}()
	return ch
}

// --- Short variable declaration inside a function (short_var_declaration) ---

func fixtureShortVars() {
	x := 42
	name := "fixture"
	_ = x
	_ = name
}

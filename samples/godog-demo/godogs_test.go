package godogdemo_test

import (
	"context"
	"errors"
	"fmt"

	"github.com/cucumber/godog"
)

type godogsCtxKey struct{}

func thereAreGodogs(ctx context.Context, available int) (context.Context, error) {
	return context.WithValue(ctx, godogsCtxKey{}, available), nil
}

func iEat(ctx context.Context, num int) (context.Context, error) {
	available, ok := ctx.Value(godogsCtxKey{}).(int)
	if !ok {
		return ctx, errors.New("no godogs available")
	}
	if available < num {
		return ctx, fmt.Errorf("cannot eat %d, only %d available", num, available)
	}
	return context.WithValue(ctx, godogsCtxKey{}, available-num), nil
}

func thereShouldBeRemaining(ctx context.Context, remaining int) error {
	available, ok := ctx.Value(godogsCtxKey{}).(int)
	if !ok {
		return errors.New("no godogs available")
	}
	if available != remaining {
		return fmt.Errorf("expected %d remaining, got %d", remaining, available)
	}
	return nil
}

func InitializeScenario(ctx *godog.ScenarioContext) {
	ctx.Given(`^there are (\d+) godogs$`, thereAreGodogs)
	ctx.When(`^I eat (\d+)$`, iEat)
	ctx.Then(`^there should be (\d+) remaining$`, thereShouldBeRemaining)
}

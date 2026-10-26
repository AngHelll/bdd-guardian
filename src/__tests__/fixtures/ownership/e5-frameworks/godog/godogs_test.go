package ownership

import "github.com/cucumber/godog"

func InitializeScenario(ctx *godog.ScenarioContext) {
	ctx.Given(`^there are (\d+) godogs$`, thereAreGodogs)
}

func thereAreGodogs(n int) {
}

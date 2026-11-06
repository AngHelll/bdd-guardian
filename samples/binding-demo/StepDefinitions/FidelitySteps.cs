using Reqnroll;

namespace Calculator.Steps
{
    [Binding, Scope(Feature = "Allowed")]
    public class FeatureScopedSteps
    {
        [Given("a feature scoped step")]
        public void Scoped()
        {
        }
    }

    [Binding]
    public class OutlineRowSteps
    {
        [Given("state is ready")]
        public void Ready()
        {
        }

        [Given("state is pending")]
        public void Pending()
        {
        }
    }

    [Binding]
    public class SignatureSteps
    {
        [Given("configuration exists")]
        public void WithoutTable()
        {
        }

        [Given("configuration exists")]
        public void WithTable(Table table)
        {
        }

        [Then("amount is 10")]
        [Then(@"amount is (\d+)")]
        public void Amount(int amount)
        {
        }
    }
}

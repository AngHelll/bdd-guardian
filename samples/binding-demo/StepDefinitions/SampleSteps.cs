using Reqnroll;

namespace Calculator.Steps
{
    [Binding]
    public class CalculatorSteps
    {
        private int _result;
        private string _statusMessage = "";

        // Basic patterns with \d+
        [Given(@"the calculator is initialized")]
        public void GivenTheCalculatorIsInitialized()
        {
            _result = 0;
        }

        [Given(@"the display shows ""([^""]*)""")]
        public void GivenTheDisplayShows(string display)
        {
            // Display initialization
        }

        // Pattern with \d+ for numeric matching
        [Given(@"I have entered (\d+) into the calculator")]
        public void GivenIHaveEntered(int number)
        {
            _result += number;
        }

        // Anchored pattern with ^...$
        [When(@"^I press ""([^""]+)""$")]
        public void WhenIPress(string operation)
        {
            // Perform operation
        }

        // Pattern with (.*) - greedy match
        [Then(@"the result should be (.*) on the screen")]
        public void ThenTheResultShouldBe(string result)
        {
            // Verify result
        }

        // Verbatim string with escaped quotes
        [Then(@"the status message should be ""([^""]*)""")]
        public void ThenTheStatusMessageShouldBe(string message)
        {
            _statusMessage = message;
        }

        // But step - negative assertion
        [Then(@"the memory should not be affected")]
        public void ThenTheMemoryShouldNotBeAffected()
        {
            // Verify memory state
        }

        [Then(@"the error message should not contain ""([^""]*)""")]
        public void ThenTheErrorMessageShouldNotContain(string text)
        {
            // Verify no error
        }

        // Ambiguous binding 1 - overlaps with pattern above
        [Then(@"the result should be (\d+) on the screen")]
        public void ThenTheResultShouldBeNumeric(int result)
        {
            // More specific numeric version
        }

        // Another potential ambiguity
        [Given(@"I have entered (.*) into the calculator")]
        public void GivenIHaveEnteredAnything(string value)
        {
            // Less specific - catches anything
        }
    }

    [Binding]
    public class VerbatimSteps
    {
        // Verbatim string with double quotes inside
        [Given(@"the message is ""Hello ""World""""")]
        public void GivenMessageWithQuotes()
        {
            // Tests "" -> " conversion
        }

        // Complex verbatim pattern
        [When(@"I enter text containing ""special ""chars"" and more""")]
        public void WhenEnterSpecialText()
        {
            // Complex quote handling
        }
    }
}

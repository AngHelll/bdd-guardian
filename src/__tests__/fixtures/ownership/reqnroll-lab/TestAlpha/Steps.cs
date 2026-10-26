using Reqnroll;

namespace OwnershipLab.TestAlpha
{
    [Binding]
    public class LocalPingSteps
    {
        [Given("I ping {int}")]
        public void GivenIPingFromAlpha(int count)
        {
        }
    }

    [Binding]
    public class OverlapSteps
    {
        [Given(@"I have entered (\d+) into the calculator")]
        public void GivenIHaveEnteredNumeric(int number)
        {
        }

        [Given(@"I have entered (.*) into the calculator")]
        public void GivenIHaveEnteredAnything(string value)
        {
        }
    }

    [Binding]
    public class KeywordSteps
    {
        [Given("the pump is primed")]
        public void GivenThePumpIsPrimed()
        {
        }
    }

    public class LooseAttributeSteps
    {
        [Given("the loose attribute fires")]
        public void GivenTheLooseAttributeFires()
        {
        }
    }

    [Binding]
    public class ScopeSteps
    {
        [Given("I log in with scoped credentials"), Scope(Tag = "web")]
        public void LoginWeb()
        {
        }

        [Given("I log in with scoped credentials"), Scope(Tag = "api")]
        public void LoginApi()
        {
        }
    }
}

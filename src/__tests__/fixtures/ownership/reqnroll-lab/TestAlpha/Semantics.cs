using Reqnroll;

namespace OwnershipLab.TestAlpha
{
    [Binding]
    public class MarkedBindingSteps
    {
        [Given("the marked binding fires")]
        public void GivenTheMarkedBindingFires()
        {
        }
    }

    [Reqnroll.Binding]
    public class QualifiedBindingSteps
    {
        [Given("the qualified binding class fires")]
        public void GivenTheQualifiedBindingClassFires()
        {
        }
    }

    [Binding]
    public class QualifiedAttributeSteps
    {
        [Reqnroll.Given("the qualified given matches")]
        public void GivenTheQualifiedGivenMatches()
        {
        }

        [Reqnroll.GivenAttribute("the given attribute suffix matches")]
        public void GivenTheGivenAttributeSuffixMatches()
        {
        }

        [global::Reqnroll.Given("the global given matches")]
        public void GivenTheGlobalGivenMatches()
        {
        }
    }

    [Binding]
    public class OuterHostsNested
    {
        [Binding]
        public class NestedBinding
        {
            [Given("the nested binding fires")]
            public void GivenTheNestedBindingFires()
            {
            }
        }

        [Binding]
        private class PrivateNested
        {
            [Given("the private nested binding fires")]
            public void GivenThePrivateNestedBindingFires()
            {
            }
        }
    }

    [Binding]
    public class OuterKeepsItsStep
    {
        public class HelperWithoutBinding
        {
        }

        [Given("the outer binding keeps its step")]
        public void GivenTheOuterBindingKeepsItsStep()
        {
        }
    }

    public class OuterAfterNested
    {
        [Binding]
        public class InnerOnly
        {
        }

        [Given("the outer step follows a nested class")]
        public void GivenTheOuterStepFollowsANestedClass()
        {
        }
    }

    [Binding]
    public class ConjunctionSteps
    {
        [Given("the conjunction anchor is given")]
        public void GivenTheConjunctionAnchorIsGiven()
        {
        }

        [Given("the and step follows given")]
        public void GivenTheAndStepFollowsGiven()
        {
        }

        [Given("the but step follows given")]
        public void GivenTheButStepFollowsGiven()
        {
        }

        [When("the conjunction anchor is when")]
        public void WhenTheConjunctionAnchorIsWhen()
        {
        }

        [When("the and step follows when")]
        public void WhenTheAndStepFollowsWhen()
        {
        }

        [When("the but step follows when")]
        public void WhenTheButStepFollowsWhen()
        {
        }

        [Given("the and step only has a given")]
        public void GivenTheAndStepOnlyHasAGiven()
        {
        }

        [Given("the star step follows given")]
        public void GivenTheStarStepFollowsGiven()
        {
        }

        [Given("the star step opens the scenario")]
        public void GivenTheStarStepOpensTheScenario()
        {
        }
    }
}

# -*- coding: utf-8 -*-
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import Select
from selenium.common.exceptions import NoSuchElementException
from selenium.common.exceptions import NoAlertPresentException
import unittest, time, re

class JumptoFirstNextWarnings(unittest.TestCase):
    def setUp(self):
        self.driver = webdriver.Firefox()
        self.driver.implicitly_wait(30)
        self.base_url = "http://localhost/"
        self.verificationErrors = []
        self.accept_next_alert = True
    
    def test_jumpto_first_next_warnings(self):
        driver = self.driver
        f = open('property')
        project_name = f.read()
        f.close()
        driver.get(self.base_url + "/" + project_name + "/")
        print "\nNow testing for Jumping to first/next warnings"
        driver.find_element_by_css_selector("div.ace_content").click()
        driver.find_element_by_class_name("ace_text-input").send_keys("""
process simple {    
action x{    
requires { foo }    
provides { foo }    
}    
action y{        
requires { foo }    
provides { bar }     
}
}  
""")

        driver.find_element_by_link_text("Tools").click()
        driver.find_element_by_link_text("Check syntax").click()
        # ERROR: Caught exception [Error: locator strategy either id or name must be specified explicitly.]
	driver.execute_script("moveToNext();")
	print("Moved to warning 2")
        #driver.find_element_by_xpath("(//a[contains(text(),'next')])[16]").click()
        # ERROR: Caught exception [Error: locator strategy either id or name must be specified explicitly.]
	time.sleep(1)
	print("Moved to warning 3")
	driver.execute_script("moveToNext();")
        #driver.find_element_by_xpath("(//a[contains(text(),'next')])[4]").click()
        # ERROR: Caught exception [Error: locator strategy either id or name must be specified explicitly.]
    
    def is_element_present(self, how, what):
        try: self.driver.find_element(by=how, value=what)
        except NoSuchElementException as e: return False
        return True
    
    def is_alert_present(self):
        try: self.driver.switch_to_alert()
        except NoAlertPresentException as e: return False
        return True
    
    def close_alert_and_get_its_text(self):
        try:
            alert = self.driver.switch_to_alert()
            alert_text = alert.text
            if self.accept_next_alert:
                alert.accept()
            else:
                alert.dismiss()
            return alert_text
        finally: self.accept_next_alert = True
    
    def tearDown(self):
        self.driver.quit()
        self.assertEqual([], self.verificationErrors)

if __name__ == "__main__":
    unittest.main()